"use client";

import { getSocket } from "@/lib/socket";
import { SOCKET_EVENTS } from "@cloudcanvas/shared";
import type {
  BrushStyle,
  CursorPayload,
  DrawingTool,
  ShapeKind,
  Stroke,
} from "@cloudcanvas/shared";
import { nanoid } from "nanoid";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAvatarInitials } from "@/lib/guest";

const LOGICAL_CANVAS_WIDTH = 1200;
const LOGICAL_CANVAS_HEIGHT = 700;
const MIN_SCALE = 1;
const MAX_SCALE = 3;
const SHAPE_TOOLS: ShapeKind[] = [
  "line",
  "rectangle",
  "square",
  "circle",
  "ellipse",
  "triangle",
  "star",
];

type Viewport = { scale: number; offsetX: number; offsetY: number };
type PointerMap = Map<number, { x: number; y: number }>;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);
const distanceBetween = (
  a: { x: number; y: number },
  b: { x: number; y: number },
) => Math.hypot(b.x - a.x, b.y - a.y);
const midpoint = (
  a: { x: number; y: number },
  b: { x: number; y: number },
) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const isShapeTool = (tool: DrawingTool): tool is ShapeKind =>
  SHAPE_TOOLS.includes(tool as ShapeKind);

const buildShapePath = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
  const shape = stroke.shape;
  if (!shape) return false;
  const { start, end, kind } = shape;
  let x = start.x;
  let y = start.y;
  let width = end.x - start.x;
  let height = end.y - start.y;

  if (kind === "square" || kind === "circle") {
    const side = Math.max(Math.abs(width), Math.abs(height));
    width = Math.sign(width || 1) * side;
    height = Math.sign(height || 1) * side;
  }

  const left = Math.min(x, x + width);
  const top = Math.min(y, y + height);
  const absWidth = Math.abs(width);
  const absHeight = Math.abs(height);
  const centerX = left + absWidth / 2;
  const centerY = top + absHeight / 2;

  ctx.beginPath();
  if (kind === "line") {
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
  } else if (kind === "rectangle" || kind === "square") {
    ctx.rect(left, top, absWidth, absHeight);
  } else if (kind === "circle" || kind === "ellipse") {
    ctx.ellipse(
      centerX,
      centerY,
      Math.max(1, absWidth / 2),
      Math.max(1, absHeight / 2),
      0,
      0,
      Math.PI * 2,
    );
  } else if (kind === "triangle") {
    ctx.moveTo(centerX, top);
    ctx.lineTo(left + absWidth, top + absHeight);
    ctx.lineTo(left, top + absHeight);
    ctx.closePath();
  } else if (kind === "star") {
    const spikes = 5;
    const outerRadius = Math.max(8, Math.max(absWidth, absHeight) / 2);
    const innerRadius = outerRadius * 0.45;
    const radiusYScale = absWidth === 0 ? 1 : absHeight / Math.max(absWidth, 1);
    for (let i = 0; i < spikes * 2; i += 1) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (Math.PI / spikes) * i - Math.PI / 2;
      const px = centerX + Math.cos(angle) * radius;
      const py = centerY + Math.sin(angle) * radius * radiusYScale;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }
  return true;
};

const hexToRgb = (color: string) => {
  const normalized = color.replace("#", "").trim();
  const hex =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : normalized;
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return { r: 0, g: 0, b: 0 };
  const parsed = Number.parseInt(hex, 16);
  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
  };
};

const colorsMatch = (
  data: Uint8ClampedArray,
  index: number,
  target: { r: number; g: number; b: number; a: number },
) =>
  data[index] === target.r &&
  data[index + 1] === target.g &&
  data[index + 2] === target.b &&
  data[index + 3] === target.a;

const applyFloodFill = (
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  width: number,
  height: number,
) => {
  const startPoint = stroke.points[0];
  if (!startPoint) return;

  const transform = ctx.getTransform();
  const pixelWidth = Math.max(1, Math.round(width * transform.a));
  const pixelHeight = Math.max(1, Math.round(height * transform.d));
  const startX = clamp(
    Math.round(startPoint.x * transform.a),
    0,
    pixelWidth - 1,
  );
  const startY = clamp(
    Math.round(startPoint.y * transform.d),
    0,
    pixelHeight - 1,
  );
  const image = ctx.getImageData(0, 0, pixelWidth, pixelHeight);
  const { data } = image;
  const startIndex = (startY * pixelWidth + startX) * 4;
  const target = {
    r: data[startIndex],
    g: data[startIndex + 1],
    b: data[startIndex + 2],
    a: data[startIndex + 3],
  };
  const fill = hexToRgb(stroke.color);

  if (
    target.r === fill.r &&
    target.g === fill.g &&
    target.b === fill.b &&
    target.a === 255
  ) {
    return;
  }

  const stack = [[startX, startY]];
  const visited = new Uint8Array(pixelWidth * pixelHeight);

  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;
    const [x, y] = current;
    const cellIndex = y * pixelWidth + x;
    if (visited[cellIndex]) continue;
    visited[cellIndex] = 1;

    const pixelIndex = cellIndex * 4;
    if (!colorsMatch(data, pixelIndex, target)) continue;

    data[pixelIndex] = fill.r;
    data[pixelIndex + 1] = fill.g;
    data[pixelIndex + 2] = fill.b;
    data[pixelIndex + 3] = 255;

    if (x > 0) stack.push([x - 1, y]);
    if (x < pixelWidth - 1) stack.push([x + 1, y]);
    if (y > 0) stack.push([x, y - 1]);
    if (y < pixelHeight - 1) stack.push([x, y + 1]);
  }

  ctx.putImageData(image, 0, 0);
};

const renderStroke = (
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  preview = false,
) => {
  if (stroke.tool === "fill") {
    applyFloodFill(ctx, stroke, LOGICAL_CANVAS_WIDTH, LOGICAL_CANVAS_HEIGHT);
    return;
  }

  if (stroke.shape) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = stroke.size;
    ctx.strokeStyle = stroke.tool === "eraser" ? "#ffffff" : stroke.color;
    if (buildShapePath(ctx, stroke)) {
      if (stroke.fillColor && stroke.tool !== "eraser") {
        ctx.fillStyle = stroke.fillColor;
        ctx.fill();
      }
      if (preview) ctx.globalAlpha = 0.8;
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  if (!stroke.points.length) return;
  const activeBrushStyle = stroke.brushStyle ?? "classic";
  ctx.save();
  ctx.lineCap = activeBrushStyle === "dotted" ? "butt" : "round";
  ctx.lineJoin = "round";
  const strokeColor = stroke.tool === "eraser" ? "#ffffff" : stroke.color;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = stroke.size;
  if (activeBrushStyle === "dotted") {
    ctx.setLineDash([1, Math.max(6, stroke.size * 1.35)]);
  }
  if (activeBrushStyle === "crayon") {
    ctx.globalAlpha = 0.82;
    ctx.lineWidth = stroke.size * 1.15;
    ctx.setLineDash([0.75, Math.max(1.5, stroke.size * 0.65)]);
  }
  if (activeBrushStyle === "neon") {
    ctx.shadowColor = strokeColor;
    ctx.shadowBlur = Math.max(4, stroke.size * 1.5);
  }
  if (stroke.points.length < 3) {
    const point = stroke.points[0];
    ctx.beginPath();
    ctx.arc(point.x, point.y, stroke.size / 2, 0, Math.PI * 2);
    ctx.fillStyle = strokeColor;
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
  for (let i = 1; i < stroke.points.length - 1; i += 1) {
    const current = stroke.points[i];
    const next = stroke.points[i + 1];
    const midX = (current.x + next.x) / 2;
    const midY = (current.y + next.y) / 2;
    ctx.quadraticCurveTo(current.x, current.y, midX, midY);
  }
  const last = stroke.points[stroke.points.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
  if (activeBrushStyle === "spray" && stroke.tool !== "eraser") {
    for (const point of stroke.points) {
      for (let i = 0; i < Math.max(4, Math.floor(stroke.size)); i += 1) {
        const offsetX = (Math.random() - 0.5) * stroke.size * 2.1;
        const offsetY = (Math.random() - 0.5) * stroke.size * 2.1;
        ctx.fillStyle = stroke.color;
        ctx.fillRect(point.x + offsetX, point.y + offsetY, 1.5, 1.5);
      }
    }
  }
  ctx.restore();
};

interface CanvasBoardProps {
  roomId: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  tool: DrawingTool;
  brushStyle: BrushStyle;
  color: string;
  fillColor: string;
  fillEnabled: boolean;
  size: number;
  strokes: Stroke[];
  cursors: Record<string, CursorPayload>;
  setStrokes: React.Dispatch<React.SetStateAction<Stroke[]>>;
  disabled?: boolean;
  resetViewSignal: number;
  compact?: boolean;
  onSurfaceInteract?: () => void;
}

function CanvasBoardComponent({
  roomId,
  userId,
  displayName,
  avatarUrl,
  tool,
  brushStyle,
  color,
  fillColor,
  fillEnabled,
  size,
  strokes,
  cursors,
  setStrokes,
  disabled = false,
  resetViewSignal,
  compact = false,
  onSurfaceInteract,
}: CanvasBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const drawingRef = useRef(false);
  const currentStrokeId = useRef("");
  const pendingPointsRef = useRef<Stroke["points"]>([]);
  const draftStrokeRef = useRef<Stroke | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const emitCursorRef = useRef<number | null>(null);
  const renderFrameRef = useRef<number | null>(null);
  const pointsSinceFlushRef = useRef(0);
  const pointersRef = useRef<PointerMap>(new Map());
  const panStartRef = useRef<{
    x: number;
    y: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const gestureRef = useRef<{
    firstId: number;
    secondId: number;
    startDistance: number;
    startScale: number;
    startOffsetX: number;
    startOffsetY: number;
    startCenterX: number;
    startCenterY: number;
  } | null>(null);
  const strokesRef = useRef(strokes);
  const [canvasVersion, setCanvasVersion] = useState(0);
  const [viewport, setViewport] = useState<Viewport>({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  });
  const previewStrokeRef = useRef<Stroke | null>(null);
  const viewportRef = useRef<Viewport>({ scale: 1, offsetX: 0, offsetY: 0 });

  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);

  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  const viewportStyle = useMemo<React.CSSProperties>(
    () => ({
      transform: `translate(${viewport.offsetX}px, ${viewport.offsetY}px) scale(${viewport.scale})`,
      transformOrigin: "center",
    }),
    [viewport.offsetX, viewport.offsetY, viewport.scale],
  );

  const queueRender = () => {
    if (renderFrameRef.current !== null) return;
    renderFrameRef.current = requestAnimationFrame(() => {
      renderFrameRef.current = null;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return;
      const scaleX = canvas.width / LOGICAL_CANVAS_WIDTH;
      const scaleY = canvas.height / LOGICAL_CANVAS_HEIGHT;
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.setTransform(scaleX, 0, 0, scaleY, 0, 0);
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, LOGICAL_CANVAS_WIDTH, LOGICAL_CANVAS_HEIGHT);
      strokesRef.current.forEach((stroke) => renderStroke(context, stroke));
      const draftStroke = draftStrokeRef.current;
      if (draftStroke) renderStroke(context, draftStroke, true);
      const previewStroke = previewStrokeRef.current;
      if (previewStroke) renderStroke(context, previewStroke, true);
    });
  };

  const queueCursorEmit = (
    point: { x: number; y: number },
    drawing: boolean,
  ) => {
    if (emitCursorRef.current) cancelAnimationFrame(emitCursorRef.current);
    emitCursorRef.current = requestAnimationFrame(() => {
      getSocket().emit(SOCKET_EVENTS.CURSOR_UPDATE, {
        roomId,
        userId,
        displayName,
        avatarUrl,
        x: point.x,
        y: point.y,
        drawing,
        updatedAt: Date.now(),
      });
    });
  };

  const normalizeViewport = (next: Viewport) => {
    const surface = surfaceRef.current;
    if (!surface) return next;
    const rect = surface.getBoundingClientRect();
    const scaledWidth = rect.width * next.scale;
    const scaledHeight = rect.height * next.scale;
    const maxOffsetX = Math.max(0, (scaledWidth - rect.width) / 2);
    const maxOffsetY = Math.max(0, (scaledHeight - rect.height) / 2);
    return {
      scale: clamp(next.scale, MIN_SCALE, MAX_SCALE),
      offsetX: clamp(next.offsetX, -maxOffsetX, maxOffsetX),
      offsetY: clamp(next.offsetY, -maxOffsetY, maxOffsetY),
    };
  };

  const getCanvasPoint = (clientX: number, clientY: number) => {
    const surface = surfaceRef.current;
    if (!surface) return null;
    const rect = surface.getBoundingClientRect();
    const viewport = viewportRef.current;
    const localX = clientX - rect.left - rect.width / 2;
    const localY = clientY - rect.top - rect.height / 2;
    const contentX = (localX - viewport.offsetX) / viewport.scale;
    const contentY = (localY - viewport.offsetY) / viewport.scale;
    const normalizedX =
      ((contentX + rect.width / 2) / rect.width) * LOGICAL_CANVAS_WIDTH;
    const normalizedY =
      ((contentY + rect.height / 2) / rect.height) * LOGICAL_CANVAS_HEIGHT;
    return {
      x: clamp(normalizedX, 0, LOGICAL_CANVAS_WIDTH),
      y: clamp(normalizedY, 0, LOGICAL_CANVAS_HEIGHT),
    };
  };

  const zoomAtPoint = (clientX: number, clientY: number, nextScale: number) => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const rect = surface.getBoundingClientRect();
    setViewport((current) => {
      const clampedScale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
      const pointerX = clientX - rect.left;
      const pointerY = clientY - rect.top;
      const contentX =
        (pointerX - rect.width / 2 - current.offsetX) / current.scale;
      const contentY =
        (pointerY - rect.height / 2 - current.offsetY) / current.scale;
      return normalizeViewport({
        scale: clampedScale,
        offsetX: pointerX - rect.width / 2 - contentX * clampedScale,
        offsetY: pointerY - rect.height / 2 - contentY * clampedScale,
      });
    });
  };

  const flushPendingPoints = () => {
    if (!pendingPointsRef.current.length || !currentStrokeId.current) return;
    const pointsToSend = pendingPointsRef.current;
    pendingPointsRef.current = [];
    pointsSinceFlushRef.current = 0;
    getSocket().emit(SOCKET_EVENTS.STROKE_APPEND, {
      roomId,
      strokeId: currentStrokeId.current,
      points: pointsToSend,
    });
  };

  const commitDraftStroke = useCallback(
    (stroke: Stroke) => {
      setStrokes((prev) => {
        const next = [...prev];
        const index = next.findIndex(
          (item) => item.strokeId === stroke.strokeId,
        );
        if (index >= 0) next[index] = stroke;
        else next.push(stroke);
        return next;
      });
    },
    [setStrokes],
  );

  const finishStroke = useCallback(() => {
    flushPendingPoints();
    const strokeId = currentStrokeId.current;
    if (!strokeId) return;
    const draftStroke = draftStrokeRef.current;
    if (draftStroke) {
      commitDraftStroke({ ...draftStroke, points: [...draftStroke.points] });
    }
    getSocket().emit(SOCKET_EVENTS.STROKE_END, {
      roomId,
      strokeId,
    });
    currentStrokeId.current = "";
    drawingRef.current = false;
    draftStrokeRef.current = null;
    queueRender();
  }, [commitDraftStroke, roomId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const syncCanvasResolution = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const nextWidth = Math.max(1, Math.round(rect.width * dpr));
      const nextHeight = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
        canvas.width = nextWidth;
        canvas.height = nextHeight;
        setCanvasVersion((version) => version + 1);
      }
    };
    syncCanvasResolution();
    const observer = new ResizeObserver(syncCanvasResolution);
    observer.observe(canvas);
    window.addEventListener("resize", syncCanvasResolution);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncCanvasResolution);
    };
  }, []);

  useEffect(() => {
    queueRender();
  }, [canvasVersion, strokes]);

  useEffect(() => {
    setViewport({ scale: 1, offsetX: 0, offsetY: 0 });
  }, [resetViewSignal]);

  useEffect(
    () => () => {
      if (emitCursorRef.current) cancelAnimationFrame(emitCursorRef.current);
      if (renderFrameRef.current) cancelAnimationFrame(renderFrameRef.current);
    },
    [],
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;

    onSurfaceInteract?.();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    if (pointersRef.current.size === 2) {
      const entries = Array.from(pointersRef.current.entries());
      const first = entries[0];
      const second = entries[1];
      if (first && second) {
        const firstPoint = first[1];
        const secondPoint = second[1];
        const center = midpoint(firstPoint, secondPoint);
        gestureRef.current = {
          firstId: first[0],
          secondId: second[0],
          startDistance: distanceBetween(firstPoint, secondPoint),
          startScale: viewport.scale,
          startOffsetX: viewport.offsetX,
          startOffsetY: viewport.offsetY,
          startCenterX: center.x,
          startCenterY: center.y,
        };
      }
      drawingRef.current = false;
      if (activePointerIdRef.current !== null) finishStroke();
      activePointerIdRef.current = null;
      return;
    }

    if (event.button === 1 || event.shiftKey) {
      panStartRef.current = {
        x: event.clientX,
        y: event.clientY,
        offsetX: viewport.offsetX,
        offsetY: viewport.offsetY,
      };
      activePointerIdRef.current = event.pointerId;
      return;
    }

    const point = getCanvasPoint(event.clientX, event.clientY);
    if (!point) return;

    activePointerIdRef.current = event.pointerId;

    if (tool === "fill") {
      const strokeId = nanoid();
      const fillStroke: Stroke = {
        strokeId,
        roomId,
        userId,
        tool: "fill",
        brushStyle: "classic",
        color: fillColor,
        fillColor: null,
        size: 1,
        points: [point],
        timestamp: Date.now(),
      };
      setStrokes((prev) => [...prev, fillStroke]);
      getSocket().emit(SOCKET_EVENTS.STROKE_START, {
        roomId,
        stroke: fillStroke,
      });
      getSocket().emit(SOCKET_EVENTS.STROKE_END, { roomId, strokeId });
      queueCursorEmit(point, false);
      activePointerIdRef.current = null;
      return;
    }

    if (isShapeTool(tool)) {
      const strokeId = nanoid();
      currentStrokeId.current = strokeId;
      drawingRef.current = true;
      const nextStroke: Stroke = {
        strokeId,
        roomId,
        userId,
        tool,
        brushStyle,
        color,
        fillColor: fillEnabled ? fillColor : null,
        size,
        points: [],
        shape: {
          kind: tool,
          start: point,
          end: point,
          fillColor: fillEnabled ? fillColor : null,
        },
        timestamp: Date.now(),
      };
      previewStrokeRef.current = nextStroke;
      queueRender();
      queueCursorEmit(point, true);
      return;
    }

    const strokeId = nanoid();
    currentStrokeId.current = strokeId;
    drawingRef.current = true;
    const nextStroke: Stroke = {
      strokeId,
      roomId,
      userId,
      tool,
      brushStyle,
      color,
      fillColor: null,
      size,
      points: [point],
      timestamp: Date.now(),
    };
    pendingPointsRef.current = [point];
    pointsSinceFlushRef.current = 1;
    draftStrokeRef.current = nextStroke;
    setStrokes((prev) => [...prev, nextStroke]);
    getSocket().emit(SOCKET_EVENTS.STROKE_START, {
      roomId,
      stroke: nextStroke,
    });
    queueRender();
    queueCursorEmit(point, true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const point = getCanvasPoint(event.clientX, event.clientY);
    if (!point) return;

    if (pointersRef.current.has(event.pointerId)) {
      pointersRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
    }

    if (gestureRef.current) {
      const first = pointersRef.current.get(gestureRef.current.firstId);
      const second = pointersRef.current.get(gestureRef.current.secondId);
      if (!first || !second) return;
      const nextDistance = distanceBetween(first, second);
      const center = midpoint(first, second);
      setViewport(
        normalizeViewport({
          scale: clamp(
            (nextDistance / gestureRef.current.startDistance) *
              gestureRef.current.startScale,
            MIN_SCALE,
            MAX_SCALE,
          ),
          offsetX:
            gestureRef.current.startOffsetX +
            (center.x - gestureRef.current.startCenterX) +
            (center.x - gestureRef.current.startCenterX) *
              (nextDistance / gestureRef.current.startDistance - 1),
          offsetY:
            gestureRef.current.startOffsetY +
            (center.y - gestureRef.current.startCenterY) +
            (center.y - gestureRef.current.startCenterY) *
              (nextDistance / gestureRef.current.startDistance - 1),
        }),
      );
      return;
    }

    if (panStartRef.current && activePointerIdRef.current === event.pointerId) {
      const currentViewport = viewportRef.current;
      setViewport(
        normalizeViewport({
          scale: currentViewport.scale,
          offsetX:
            panStartRef.current.offsetX +
            (event.clientX - panStartRef.current.x),
          offsetY:
            panStartRef.current.offsetY +
            (event.clientY - panStartRef.current.y),
        }),
      );
      return;
    }

    queueCursorEmit(point, drawingRef.current);
    if (!drawingRef.current || activePointerIdRef.current !== event.pointerId) {
      return;
    }

    const previewStroke = previewStrokeRef.current;
    if (previewStroke?.shape) {
      const current = previewStroke;
      if (current?.shape) {
        previewStrokeRef.current = {
          ...current,
          shape: { ...current.shape, end: point },
        };
        queueRender();
      }
      return;
    }

    if (!draftStrokeRef.current) return;
    draftStrokeRef.current = {
      ...draftStrokeRef.current,
      points: [...draftStrokeRef.current.points, point],
    };
    pendingPointsRef.current.push(point);
    pointsSinceFlushRef.current += 1;
    queueRender();
    if (pointsSinceFlushRef.current >= 4) {
      flushPendingPoints();
    }
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const point = getCanvasPoint(event.clientX, event.clientY);
    pointersRef.current.delete(event.pointerId);
    if (gestureRef.current && pointersRef.current.size < 2)
      gestureRef.current = null;
    if (panStartRef.current && activePointerIdRef.current === event.pointerId) {
      panStartRef.current = null;
      activePointerIdRef.current = null;
      return;
    }
    if (!point) return;

    const previewStroke = previewStrokeRef.current;
    if (
      previewStroke?.shape &&
      activePointerIdRef.current === event.pointerId
    ) {
      const committed: Stroke = {
        ...previewStroke,
        shape: { ...previewStroke.shape, end: point },
        timestamp: Date.now(),
      };
      previewStrokeRef.current = null;
      setStrokes((prev) => [...prev, committed]);
      getSocket().emit(SOCKET_EVENTS.STROKE_START, {
        roomId,
        stroke: committed,
      });
      getSocket().emit(SOCKET_EVENTS.STROKE_END, {
        roomId,
        strokeId: committed.strokeId,
      });
      drawingRef.current = false;
      activePointerIdRef.current = null;
      queueRender();
      queueCursorEmit(point, false);
      return;
    }

    if (activePointerIdRef.current === event.pointerId) {
      finishStroke();
      activePointerIdRef.current = null;
    }
    queueCursorEmit(point, false);
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.15 : 0.15;
    zoomAtPoint(event.clientX, event.clientY, viewport.scale + delta);
  };

  return (
    <div className="h-full min-h-0 p-0.5 sm:p-1">
      <div
        ref={surfaceRef}
        className="relative h-full overflow-hidden rounded-[22px] bg-[#c7e8ff] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.28),0_18px_44px_rgba(15,23,42,0.14)] sm:rounded-[24px]"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        style={{ touchAction: "none" }}
      >
        <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-full bg-[rgba(12,22,34,0.74)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white shadow-lg">
          {Math.round(viewport.scale * 100)}%
        </div>
        <div
          style={viewportStyle}
          className="relative aspect-[12/7] h-full w-full will-change-transform"
        >
          <canvas
            ref={canvasRef}
            className="h-full w-full rounded-[20px] bg-white sm:rounded-[22px]"
          />
          <div className="pointer-events-none absolute inset-0">
            {Object.values(cursors)
              .filter(
                (cursor) =>
                  cursor.userId !== userId &&
                  Date.now() - cursor.updatedAt < 4000,
              )
              .map((cursor) => (
                <div
                  key={cursor.userId}
                  className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-150 ease-out"
                  style={{
                    left: `${(cursor.x / LOGICAL_CANVAS_WIDTH) * 100}%`,
                    top: `${(cursor.y / LOGICAL_CANVAS_HEIGHT) * 100}%`,
                  }}
                >
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={`flex items-center justify-center overflow-hidden rounded-full border-2 border-white bg-slate-900 text-white shadow-md ring-1 ring-slate-200 ${compact ? "h-7 w-7 text-[10px]" : "h-8 w-8 text-[11px] sm:h-9 sm:w-9"}`}
                    >
                      {cursor.avatarUrl ? (
                        <img
                          src={cursor.avatarUrl}
                          alt={cursor.displayName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="font-semibold leading-none">
                          {getAvatarInitials(cursor.displayName)}
                        </span>
                      )}
                    </div>
                    <span className="max-w-[92px] rounded-full bg-white/95 px-2 py-0.5 text-center text-[10px] font-black leading-none text-[color:var(--text-main)] shadow-sm">
                      {cursor.displayName}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export const CanvasBoard = memo(CanvasBoardComponent);
