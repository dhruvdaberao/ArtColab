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
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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

const MIN_POINT_DISTANCE = 0.75;
const MAX_APPEND_BATCH = 30;
const APPEND_FLUSH_THRESHOLD = 2;
const TAP_SHAPE_THRESHOLD = 8;

const DEFAULT_SHAPE_SIZE: Record<ShapeKind, { width: number; height: number }> =
  {
    line: { width: 96, height: 0 },
    rectangle: { width: 128, height: 80 },
    square: { width: 92, height: 92 },
    circle: { width: 92, height: 92 },
    ellipse: { width: 128, height: 80 },
    triangle: { width: 110, height: 92 },
    star: { width: 108, height: 108 },
  };

const appendPointIfNeeded = (
  points: Stroke["points"],
  point: { x: number; y: number },
) => {
  const lastPoint = points[points.length - 1];
  if (
    lastPoint &&
    Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y) <
      MIN_POINT_DISTANCE
  ) {
    return points;
  }
  return [...points, point];
};

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

const FILL_COLOR_TOLERANCE = 14;

const colorsMatch = (
  data: Uint8ClampedArray,
  index: number,
  target: { r: number; g: number; b: number; a: number },
  tolerance = 0,
) =>
  Math.abs(data[index] - target.r) <= tolerance &&
  Math.abs(data[index + 1] - target.g) <= tolerance &&
  Math.abs(data[index + 2] - target.b) <= tolerance &&
  Math.abs(data[index + 3] - target.a) <= Math.max(8, tolerance);

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
    Math.abs(target.r - fill.r) <= 1 &&
    Math.abs(target.g - fill.g) <= 1 &&
    Math.abs(target.b - fill.b) <= 1 &&
    target.a >= 247
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
    if (!colorsMatch(data, pixelIndex, target, FILL_COLOR_TOLERANCE)) continue;

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

const getScaledContext = (canvas: HTMLCanvasElement) => {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  const scaleX = canvas.width / LOGICAL_CANVAS_WIDTH;
  const scaleY = canvas.height / LOGICAL_CANVAS_HEIGHT;
  context.setTransform(1, 0, 0, 1, 0, 0);
  return { context, scaleX, scaleY };
};

const resetCommittedSurface = (
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
) => {
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  const scaleX = canvas.width / LOGICAL_CANVAS_WIDTH;
  const scaleY = canvas.height / LOGICAL_CANVAS_HEIGHT;
  context.setTransform(scaleX, 0, 0, scaleY, 0, 0);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, LOGICAL_CANVAS_WIDTH, LOGICAL_CANVAS_HEIGHT);
};

const drawStrokeSegment = (
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  startIndex: number,
) => {
  if (stroke.tool === "fill" || stroke.shape || stroke.points.length <= 1) {
    renderStroke(ctx, stroke);
    return;
  }

  const segmentStart = Math.max(0, startIndex - 1);
  const segmentPoints = stroke.points.slice(segmentStart);
  if (!segmentPoints.length) return;
  renderStroke(ctx, { ...stroke, points: segmentPoints });
};

const cloneStroke = (stroke: Stroke): Stroke => ({
  ...stroke,
  points: [...stroke.points],
  shape: stroke.shape
    ? {
        ...stroke.shape,
        start: { ...stroke.shape.start },
        end: { ...stroke.shape.end },
      }
    : undefined,
});

const getCommittedShapeStroke = (stroke: Stroke): Stroke => {
  if (!stroke.shape) return cloneStroke(stroke);
  const { start, end, kind } = stroke.shape;
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const distance = Math.hypot(deltaX, deltaY);

  if (distance >= TAP_SHAPE_THRESHOLD) return cloneStroke(stroke);

  const fallback = DEFAULT_SHAPE_SIZE[kind];
  const halfWidth = fallback.width / 2;
  const halfHeight = fallback.height / 2;
  const center = { x: start.x, y: start.y };

  return {
    ...cloneStroke(stroke),
    shape: {
      ...stroke.shape,
      start: {
        x: clamp(center.x - halfWidth, 0, LOGICAL_CANVAS_WIDTH),
        y: clamp(center.y - halfHeight, 0, LOGICAL_CANVAS_HEIGHT),
      },
      end: {
        x: clamp(center.x + halfWidth, 0, LOGICAL_CANVAS_WIDTH),
        y: clamp(center.y + halfHeight, 0, LOGICAL_CANVAS_HEIGHT),
      },
    },
  };
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
  layoutReadySignal?: string;
  onSurfaceInteract?: () => void;
  onBoardReadyChange?: (ready: boolean) => void;
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
  layoutReadySignal,
  onSurfaceInteract,
  onBoardReadyChange,
}: CanvasBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const committedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const boardFrameRef = useRef<HTMLDivElement | null>(null);
  const drawingRef = useRef(false);
  const currentStrokeId = useRef("");
  const pendingPointsRef = useRef<Stroke["points"]>([]);
  const draftStrokeRef = useRef<Stroke | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const emitCursorRef = useRef<number | null>(null);
  const renderFrameRef = useRef<number | null>(null);
  const layoutRetryFrameRef = useRef<number | null>(null);
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
  const touchGestureRef = useRef<{
    startDistance: number;
    startScale: number;
    startOffsetX: number;
    startOffsetY: number;
    startCenterX: number;
    startCenterY: number;
  } | null>(null);
  const gestureModeRef = useRef(false);
  const strokesRef = useRef(strokes);
  const committedStrokesRef = useRef<Stroke[]>([]);
  const [canvasVersion, setCanvasVersion] = useState(0);
  const [boardFrameSize, setBoardFrameSize] = useState<{
    width: number;
    height: number;
  }>({
    width: LOGICAL_CANVAS_WIDTH,
    height: LOGICAL_CANVAS_HEIGHT,
  });
  const [viewport, setViewport] = useState<Viewport>({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  });
  const previewStrokeRef = useRef<Stroke | null>(null);
  const viewportRef = useRef<Viewport>({ scale: 1, offsetX: 0, offsetY: 0 });

  const surfaceReadyRef = useRef(false);

  const updateSurfaceReady = useCallback(
    (ready: boolean) => {
      if (surfaceReadyRef.current === ready) return;
      surfaceReadyRef.current = ready;
      onBoardReadyChange?.(ready);
    },
    [onBoardReadyChange],
  );

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

  const syncCommittedCanvas = useCallback(
    (nextStrokes: Stroke[] = strokesRef.current) => {
      const canvas = committedCanvasRef.current;
      const displayCanvas = canvasRef.current;
      if (!canvas || !displayCanvas) return;
      if (
        canvas.width !== displayCanvas.width ||
        canvas.height !== displayCanvas.height
      ) {
        canvas.width = displayCanvas.width;
        canvas.height = displayCanvas.height;
      }
      const scaled = getScaledContext(canvas);
      if (!scaled) return;
      resetCommittedSurface(scaled.context, canvas);
      nextStrokes.forEach((stroke) => renderStroke(scaled.context, stroke));
      committedStrokesRef.current = nextStrokes.map(cloneStroke);
    },
    [],
  );

  const commitStrokeToCommittedCanvas = useCallback(
    (stroke: Stroke) => {
      const canvas = committedCanvasRef.current;
      const displayCanvas = canvasRef.current;
      if (!canvas || !displayCanvas) return false;
      if (
        canvas.width !== displayCanvas.width ||
        canvas.height !== displayCanvas.height
      ) {
        canvas.width = displayCanvas.width;
        canvas.height = displayCanvas.height;
        syncCommittedCanvas(strokesRef.current);
      }
      const scaled = getScaledContext(canvas);
      if (!scaled) return false;
      scaled.context.setTransform(scaled.scaleX, 0, 0, scaled.scaleY, 0, 0);
      renderStroke(scaled.context, stroke);
      committedStrokesRef.current = [
        ...committedStrokesRef.current,
        cloneStroke(stroke),
      ];
      return true;
    },
    [syncCommittedCanvas],
  );

  const applyIncrementalStrokeUpdates = useCallback((nextStrokes: Stroke[]) => {
    const canvas = committedCanvasRef.current;
    const displayCanvas = canvasRef.current;
    if (!canvas || !displayCanvas) return false;
    const previous = committedStrokesRef.current;
    if (!previous.length && !nextStrokes.length) return true;
    if (!previous.length || nextStrokes.length < previous.length) return false;

    let diffIndex = -1;
    for (let index = 0; index < nextStrokes.length; index += 1) {
      const prevStroke = previous[index];
      const nextStroke = nextStrokes[index];
      if (!prevStroke) {
        diffIndex = index;
        break;
      }
      const sameIdentity = prevStroke.strokeId === nextStroke.strokeId;
      const sameShape =
        JSON.stringify(prevStroke.shape ?? null) ===
        JSON.stringify(nextStroke.shape ?? null);
      if (
        sameIdentity &&
        prevStroke.points.length === nextStroke.points.length &&
        prevStroke.color === nextStroke.color &&
        prevStroke.fillColor === nextStroke.fillColor &&
        prevStroke.tool === nextStroke.tool &&
        prevStroke.size === nextStroke.size &&
        sameShape
      )
        continue;
      diffIndex = index;
      break;
    }

    if (diffIndex === -1) {
      if (nextStrokes.length !== previous.length) diffIndex = previous.length;
      else return true;
    }

    const scaled = getScaledContext(canvas);
    if (!scaled) return false;

    const prevStroke = previous[diffIndex];
    const nextStroke = nextStrokes[diffIndex];
    const isSingleAppend =
      diffIndex === nextStrokes.length - 1 &&
      previous.length + 1 === nextStrokes.length &&
      !prevStroke &&
      !!nextStroke;

    const isTailGrowth =
      diffIndex === nextStrokes.length - 1 &&
      previous.length === nextStrokes.length &&
      !!prevStroke &&
      !!nextStroke &&
      prevStroke.strokeId === nextStroke.strokeId &&
      prevStroke.points.length < nextStroke.points.length &&
      !prevStroke.shape &&
      !nextStroke.shape &&
      prevStroke.tool !== "fill";

    if (isSingleAppend && nextStroke) {
      scaled.context.setTransform(scaled.scaleX, 0, 0, scaled.scaleY, 0, 0);
      renderStroke(scaled.context, nextStroke);
    } else if (isTailGrowth && prevStroke && nextStroke) {
      scaled.context.setTransform(scaled.scaleX, 0, 0, scaled.scaleY, 0, 0);
      drawStrokeSegment(scaled.context, nextStroke, prevStroke.points.length);
    } else {
      return false;
    }

    committedStrokesRef.current = nextStrokes.map(cloneStroke);
    return true;
  }, []);

  const queueRender = useCallback(() => {
    if (renderFrameRef.current !== null) return;
    renderFrameRef.current = requestAnimationFrame(() => {
      renderFrameRef.current = null;
      const canvas = canvasRef.current;
      const committedCanvas = committedCanvasRef.current;
      if (!canvas || !committedCanvas) return;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return;
      if (canvas.width < 1 || canvas.height < 1) {
        console.warn(
          "[canvas-board] skipped render for invalid display canvas",
          {
            roomId,
            width: canvas.width,
            height: canvas.height,
          },
        );
        return;
      }
      if (committedCanvas.width < 1 || committedCanvas.height < 1) {
        console.warn(
          "[canvas-board] committed canvas missing backing surface, re-syncing",
          {
            roomId,
            width: committedCanvas.width,
            height: committedCanvas.height,
          },
        );
        syncCommittedCanvas(strokesRef.current);
      }
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(committedCanvas, 0, 0);
      const scaleX = canvas.width / LOGICAL_CANVAS_WIDTH;
      const scaleY = canvas.height / LOGICAL_CANVAS_HEIGHT;
      context.setTransform(scaleX, 0, 0, scaleY, 0, 0);
      const draftStroke = draftStrokeRef.current;
      if (draftStroke) renderStroke(context, draftStroke, true);
      const previewStroke = previewStrokeRef.current;
      if (previewStroke) renderStroke(context, previewStroke, true);
      updateSurfaceReady(true);
    });
  }, [roomId, syncCommittedCanvas, updateSurfaceReady]);

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
    const boardFrame = boardFrameRef.current;
    if (!surface || !boardFrame) return next;
    const rect = boardFrame.getBoundingClientRect();
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
    const boardFrame = boardFrameRef.current;
    if (!boardFrame) return null;
    const rect = boardFrame.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      console.warn(
        "[canvas-board] invalid board frame dimensions while mapping pointer",
        {
          roomId,
          width: rect.width,
          height: rect.height,
        },
      );
      return null;
    }
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
    const boardFrame = boardFrameRef.current;
    if (!boardFrame) return;
    const rect = boardFrame.getBoundingClientRect();
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

  const applyGestureViewport = useCallback(
    (
      start: {
        startDistance: number;
        startScale: number;
        startOffsetX: number;
        startOffsetY: number;
        startCenterX: number;
        startCenterY: number;
      },
      currentTouches: [{ x: number; y: number }, { x: number; y: number }],
    ) => {
      const nextDistance = distanceBetween(
        currentTouches[0],
        currentTouches[1],
      );
      const safeDistance = start.startDistance || nextDistance || 1;
      const center = midpoint(currentTouches[0], currentTouches[1]);
      const scaleRatio = nextDistance / safeDistance;
      setViewport(
        normalizeViewport({
          scale: clamp(start.startScale * scaleRatio, MIN_SCALE, MAX_SCALE),
          offsetX:
            start.startOffsetX +
            (center.x - start.startCenterX) +
            (center.x - start.startCenterX) * (scaleRatio - 1),
          offsetY:
            start.startOffsetY +
            (center.y - start.startCenterY) +
            (center.y - start.startCenterY) * (scaleRatio - 1),
        }),
      );
    },
    [],
  );

  const flushPendingPoints = () => {
    if (!pendingPointsRef.current.length || !currentStrokeId.current) return;
    while (pendingPointsRef.current.length) {
      const pointsToSend = pendingPointsRef.current.slice(0, MAX_APPEND_BATCH);
      pendingPointsRef.current =
        pendingPointsRef.current.slice(MAX_APPEND_BATCH);
      getSocket().emit(SOCKET_EVENTS.STROKE_APPEND, {
        roomId,
        strokeId: currentStrokeId.current,
        points: pointsToSend,
      });
    }
    pointsSinceFlushRef.current = 0;
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
  }, [commitDraftStroke, queueRender, roomId]);

  const syncBoardFrameSize = useCallback(() => {
    const surface = surfaceRef.current;
    if (!surface) return false;
    const rect = surface.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      setBoardFrameSize((current) =>
        current.width === 0 && current.height === 0
          ? current
          : { width: 0, height: 0 },
      );
      return false;
    }

    const widthFromHeight =
      (rect.height * LOGICAL_CANVAS_WIDTH) / LOGICAL_CANVAS_HEIGHT;
    const heightFromWidth =
      (rect.width * LOGICAL_CANVAS_HEIGHT) / LOGICAL_CANVAS_WIDTH;
    const nextSize =
      widthFromHeight <= rect.width
        ? { width: widthFromHeight, height: rect.height }
        : { width: rect.width, height: heightFromWidth };

    setBoardFrameSize((current) =>
      Math.abs(current.width - nextSize.width) < 0.5 &&
      Math.abs(current.height - nextSize.height) < 0.5
        ? current
        : nextSize,
    );
    return true;
  }, []);

  const syncCanvasResolution = useCallback(() => {
    const canvas = canvasRef.current;
    const boardFrame = boardFrameRef.current;
    if (!canvas || !boardFrame) return false;
    syncBoardFrameSize();
    const rect = boardFrame.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    if (rect.width <= 0 || rect.height <= 0) {
      console.warn("[canvas-board] board frame has invalid dimensions", {
        roomId,
        width: rect.width,
        height: rect.height,
        dpr,
      });
      updateSurfaceReady(false);
      return false;
    }
    const nextWidth = Math.max(1, Math.round(rect.width * dpr));
    const nextHeight = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      console.info("[canvas-board] syncing canvas resolution", {
        roomId,
        cssWidth: rect.width,
        cssHeight: rect.height,
        pixelWidth: nextWidth,
        pixelHeight: nextHeight,
        dpr,
      });
      canvas.width = nextWidth;
      canvas.height = nextHeight;
      setCanvasVersion((version) => version + 1);
    }
    updateSurfaceReady(true);
    return true;
  }, [roomId, syncBoardFrameSize, updateSurfaceReady]);

  useEffect(() => {
    const boardFrame = boardFrameRef.current;
    if (!boardFrame) return;
    syncBoardFrameSize();
    syncCanvasResolution();
    const observer = new ResizeObserver(() => {
      syncBoardFrameSize();
      syncCanvasResolution();
    });
    observer.observe(surfaceRef.current ?? boardFrame);
    window.addEventListener("resize", syncCanvasResolution);
    window.addEventListener("orientationchange", syncCanvasResolution);
    window.visualViewport?.addEventListener("resize", syncCanvasResolution);
    window.visualViewport?.addEventListener("scroll", syncCanvasResolution);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncCanvasResolution);
      window.removeEventListener("orientationchange", syncCanvasResolution);
      window.visualViewport?.removeEventListener(
        "resize",
        syncCanvasResolution,
      );
      window.visualViewport?.removeEventListener(
        "scroll",
        syncCanvasResolution,
      );
    };
  }, [syncCanvasResolution]);

  useLayoutEffect(() => {
    let cancelled = false;
    let attempts = 0;

    const finalizeLayout = () => {
      if (cancelled) return;
      syncCommittedCanvas(strokesRef.current);
      queueRender();
    };

    const syncWhenReady = () => {
      if (cancelled) return;
      const ready = syncCanvasResolution();
      if (ready) {
        finalizeLayout();
        return;
      }

      attempts += 1;
      if (attempts < 24) {
        layoutRetryFrameRef.current =
          window.requestAnimationFrame(syncWhenReady);
      }
    };

    updateSurfaceReady(false);
    syncWhenReady();

    return () => {
      cancelled = true;
      if (layoutRetryFrameRef.current !== null) {
        window.cancelAnimationFrame(layoutRetryFrameRef.current);
        layoutRetryFrameRef.current = null;
      }
    };
  }, [
    layoutReadySignal,
    queueRender,
    syncCanvasResolution,
    syncCommittedCanvas,
    updateSurfaceReady,
  ]);

  const resetTransientInteraction = useCallback(
    (options?: { releasePointerCapture?: boolean }) => {
      if (options?.releasePointerCapture) {
        const surface = surfaceRef.current;
        if (surface) {
          for (const pointerId of Array.from(pointersRef.current.keys())) {
            if (surface.hasPointerCapture(pointerId)) {
              try {
                surface.releasePointerCapture(pointerId);
              } catch {
                // noop
              }
            }
          }
        }
      }
      drawingRef.current = false;
      currentStrokeId.current = "";
      pendingPointsRef.current = [];
      draftStrokeRef.current = null;
      previewStrokeRef.current = null;
      activePointerIdRef.current = null;
      panStartRef.current = null;
      gestureRef.current = null;
      touchGestureRef.current = null;
      gestureModeRef.current = false;
      pointersRef.current.clear();
    },
    [],
  );

  useEffect(() => {
    syncCommittedCanvas(strokes);
    queueRender();
  }, [canvasVersion, syncCommittedCanvas, queueRender]);

  useEffect(() => {
    if (!applyIncrementalStrokeUpdates(strokes)) {
      syncCommittedCanvas(strokes);
    }
    queueRender();
  }, [
    applyIncrementalStrokeUpdates,
    queueRender,
    strokes,
    syncCommittedCanvas,
  ]);

  useEffect(() => {
    resetTransientInteraction();
    queueRender();
  }, [tool, resetTransientInteraction, queueRender]);

  useEffect(() => {
    setViewport({ scale: 1, offsetX: 0, offsetY: 0 });
  }, [resetViewSignal]);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;

    const handleTouchStart = (event: TouchEvent) => {
      if (disabled || event.touches.length < 2) return;
      const [firstTouch, secondTouch] = [event.touches[0], event.touches[1]];
      if (!firstTouch || !secondTouch) return;
      event.preventDefault();
      gestureModeRef.current = true;
      if (activePointerIdRef.current !== null || drawingRef.current) {
        finishStroke();
      }
      activePointerIdRef.current = null;
      const firstPoint = { x: firstTouch.clientX, y: firstTouch.clientY };
      const secondPoint = { x: secondTouch.clientX, y: secondTouch.clientY };
      const center = midpoint(firstPoint, secondPoint);
      touchGestureRef.current = {
        startDistance: Math.max(distanceBetween(firstPoint, secondPoint), 1),
        startScale: viewportRef.current.scale,
        startOffsetX: viewportRef.current.offsetX,
        startOffsetY: viewportRef.current.offsetY,
        startCenterX: center.x,
        startCenterY: center.y,
      };
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!touchGestureRef.current || event.touches.length < 2) return;
      const [firstTouch, secondTouch] = [event.touches[0], event.touches[1]];
      if (!firstTouch || !secondTouch) return;
      event.preventDefault();
      applyGestureViewport(touchGestureRef.current, [
        { x: firstTouch.clientX, y: firstTouch.clientY },
        { x: secondTouch.clientX, y: secondTouch.clientY },
      ]);
    };

    const endTouchGesture = () => {
      if (!touchGestureRef.current) return;
      touchGestureRef.current = null;
      window.setTimeout(() => {
        gestureModeRef.current = false;
      }, 0);
    };

    surface.addEventListener("touchstart", handleTouchStart, {
      passive: false,
    });
    surface.addEventListener("touchmove", handleTouchMove, { passive: false });
    surface.addEventListener("touchend", endTouchGesture);
    surface.addEventListener("touchcancel", endTouchGesture);

    return () => {
      surface.removeEventListener("touchstart", handleTouchStart);
      surface.removeEventListener("touchmove", handleTouchMove);
      surface.removeEventListener("touchend", endTouchGesture);
      surface.removeEventListener("touchcancel", endTouchGesture);
    };
  }, [applyGestureViewport, disabled, finishStroke]);

  useEffect(
    () => () => {
      if (emitCursorRef.current) cancelAnimationFrame(emitCursorRef.current);
      if (renderFrameRef.current) cancelAnimationFrame(renderFrameRef.current);
      if (layoutRetryFrameRef.current !== null) {
        cancelAnimationFrame(layoutRetryFrameRef.current);
        layoutRetryFrameRef.current = null;
      }
      committedStrokesRef.current = [];
      updateSurfaceReady(false);
      resetTransientInteraction();
    },
    [resetTransientInteraction, updateSurfaceReady],
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || gestureModeRef.current) return;

    onSurfaceInteract?.();
    const shouldCapturePointer = tool !== "fill";
    if (shouldCapturePointer)
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
      resetTransientInteraction({ releasePointerCapture: true });
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
      commitStrokeToCommittedCanvas(fillStroke);
      getSocket().emit(SOCKET_EVENTS.STROKE_START, {
        roomId,
        stroke: fillStroke,
      });
      getSocket().emit(SOCKET_EVENTS.STROKE_END, { roomId, strokeId });
      queueCursorEmit(point, false);
      activePointerIdRef.current = null;
      pointersRef.current.delete(event.pointerId);
      queueRender();
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
    pendingPointsRef.current = [];
    pointsSinceFlushRef.current = 0;
    draftStrokeRef.current = nextStroke;
    getSocket().emit(SOCKET_EVENTS.STROKE_START, {
      roomId,
      stroke: nextStroke,
    });
    queueRender();
    queueCursorEmit(point, true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (gestureModeRef.current) return;
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
      applyGestureViewport(gestureRef.current, [first, second]);
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
    const sourceEvents =
      typeof event.nativeEvent.getCoalescedEvents === "function"
        ? event.nativeEvent.getCoalescedEvents()
        : [event.nativeEvent];
    let nextPoints = draftStrokeRef.current.points;
    let pendingPoints = pendingPointsRef.current;

    for (const sourceEvent of sourceEvents) {
      const nextPoint = getCanvasPoint(
        sourceEvent.clientX,
        sourceEvent.clientY,
      );
      if (!nextPoint) continue;
      const appendedDraftPoints = appendPointIfNeeded(nextPoints, nextPoint);
      if (appendedDraftPoints === nextPoints) continue;
      nextPoints = appendedDraftPoints;
      pendingPoints = appendPointIfNeeded(pendingPoints, nextPoint);
    }

    if (nextPoints === draftStrokeRef.current.points) return;

    draftStrokeRef.current = {
      ...draftStrokeRef.current,
      points: nextPoints,
    };
    pendingPointsRef.current = pendingPoints;
    pointsSinceFlushRef.current = pendingPoints.length;
    queueRender();
    if (pendingPointsRef.current.length >= APPEND_FLUSH_THRESHOLD) {
      flushPendingPoints();
    }
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (gestureModeRef.current) {
      pointersRef.current.delete(event.pointerId);
      return;
    }
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
      const committed = getCommittedShapeStroke({
        ...previewStroke,
        shape: { ...previewStroke.shape, end: point },
        timestamp: Date.now(),
      });
      previewStrokeRef.current = null;
      setStrokes((prev) => [...prev, committed]);
      commitStrokeToCommittedCanvas(committed);
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
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // noop
      }
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
    <div className="flex h-full min-h-0 p-0.5 sm:p-1">
      <div
        ref={surfaceRef}
        className="relative h-full min-h-0 flex-1 overflow-hidden rounded-[22px] bg-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.28),0_18px_44px_rgba(15,23,42,0.14)] sm:rounded-[24px]"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        style={{ touchAction: "none", overscrollBehavior: "contain" }}
      >
        <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-full bg-[rgba(12,22,34,0.74)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white shadow-lg">
          {Math.round(viewport.scale * 100)}%
        </div>
        <div className="grid h-full w-full place-items-center overflow-hidden">
          <div
            ref={boardFrameRef}
            className="relative overflow-hidden rounded-[20px] sm:rounded-[22px]"
            style={{
              width: `${boardFrameSize.width}px`,
              height: `${boardFrameSize.height}px`,
              maxWidth: "100%",
              maxHeight: "100%",
            }}
          >
            <div
              style={viewportStyle}
              className="absolute inset-0 will-change-transform"
            >
              <canvas ref={committedCanvasRef} className="hidden" aria-hidden />
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
      </div>
    </div>
  );
}

export const CanvasBoard = memo(CanvasBoardComponent);
