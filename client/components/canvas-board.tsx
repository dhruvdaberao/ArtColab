"use client";

import { socket } from "@/lib/socket";
import { SOCKET_EVENTS } from "@cloudcanvas/shared";
import type {
  BrushStyle,
  CursorPayload,
  DrawingTool,
  Sticker,
  Stroke,
} from "@cloudcanvas/shared";
import { nanoid } from "nanoid";
import { useEffect, useMemo, useRef, useState } from "react";

const LOGICAL_CANVAS_WIDTH = 1200;
const LOGICAL_CANVAS_HEIGHT = 700;

const renderStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
  if (!stroke.points.length) return;

  const brushStyle = stroke.brushStyle ?? "classic";
  ctx.save();
  ctx.lineCap = brushStyle === "dotted" ? "butt" : "round";
  ctx.lineJoin = "round";
  const strokeColor = stroke.tool === "eraser" ? "#ffffff" : stroke.color;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = stroke.size;

  if (brushStyle === "dotted") {
    ctx.setLineDash([1, Math.max(6, stroke.size * 1.35)]);
  }
  if (brushStyle === "neon") {
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
    if (brushStyle === "rainbow" && stroke.tool !== "eraser") {
      ctx.strokeStyle = `hsl(${(i * 18) % 360} 95% 60%)`;
    }
    ctx.quadraticCurveTo(current.x, current.y, midX, midY);
  }

  const last = stroke.points[stroke.points.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();

  if (brushStyle === "spray" && stroke.tool !== "eraser") {
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
  stickerMode?: string | null;
  color: string;
  size: number;
  strokes: Stroke[];
  stickers: Sticker[];
  cursors: Record<string, CursorPayload>;
  setStrokes: React.Dispatch<React.SetStateAction<Stroke[]>>;
  setStickers: React.Dispatch<React.SetStateAction<Sticker[]>>;
  disabled?: boolean;
}

export function CanvasBoard({
  roomId,
  userId,
  displayName,
  avatarUrl,
  tool,
  brushStyle,
  stickerMode,
  color,
  size,
  strokes,
  stickers,
  cursors,
  setStrokes,
  setStickers,
  disabled = false,
}: CanvasBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const currentStrokeId = useRef<string>("");
  const pendingPointsRef = useRef<Stroke["points"]>([]);
  const rafRef = useRef<number | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const [canvasVersion, setCanvasVersion] = useState(0);

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
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const scaleX = canvas.width / LOGICAL_CANVAS_WIDTH;
    const scaleY = canvas.height / LOGICAL_CANVAS_HEIGHT;

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, LOGICAL_CANVAS_WIDTH, LOGICAL_CANVAS_HEIGHT);
    strokes.forEach((stroke) => renderStroke(context, stroke));
  }, [strokes, canvasVersion]);

  const flushPendingPoints = () => {
    if (!pendingPointsRef.current.length || !currentStrokeId.current) return;
    const pointsToSend = pendingPointsRef.current;
    pendingPointsRef.current = [];
    socket.emit(SOCKET_EVENTS.STROKE_APPEND, {
      roomId,
      strokeId: currentStrokeId.current,
      points: pointsToSend,
    });
  };

  const position = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * LOGICAL_CANVAS_WIDTH;
    const y = ((event.clientY - rect.top) / rect.height) * LOGICAL_CANVAS_HEIGHT;

    return {
      x: Math.min(Math.max(x, 0), LOGICAL_CANVAS_WIDTH),
      y: Math.min(Math.max(y, 0), LOGICAL_CANVAS_HEIGHT),
    };
  };

  const scheduleFlush = () => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      flushPendingPoints();
      rafRef.current = null;
    });
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled || !event.isPrimary) return;
    const point = position(event);

    if (stickerMode) {
      const sticker: Sticker = {
        stickerId: nanoid(),
        roomId,
        userId,
        value: stickerMode,
        x: point.x,
        y: point.y,
        size: Math.min(72, Math.max(30, size * 3)),
        timestamp: Date.now(),
      };
      setStickers((prev) => [...prev, sticker]);
      socket.emit(SOCKET_EVENTS.STICKER_PLACE, { roomId, sticker });
      return;
    }

    event.preventDefault();
    drawingRef.current = true;
    activePointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);

    const strokeId = nanoid();
    currentStrokeId.current = strokeId;
    const stroke: Stroke = {
      strokeId,
      roomId,
      userId,
      tool,
      brushStyle,
      color,
      size,
      points: [point],
      timestamp: Date.now(),
    };
    setStrokes((prev) => [...prev, stroke]);
    socket.emit(SOCKET_EVENTS.STROKE_START, {
      roomId,
      stroke: { ...stroke, points: [point] },
    });
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || activePointerIdRef.current !== event.pointerId) return;
    event.preventDefault();
    const point = position(event);
    setStrokes((prev) =>
      prev.map((stroke) =>
        stroke.strokeId === currentStrokeId.current
          ? { ...stroke, points: [...stroke.points, point] }
          : stroke,
      ),
    );

    pendingPointsRef.current.push(point);
    scheduleFlush();
  };

  const onPointerUp = (event?: React.PointerEvent<HTMLCanvasElement>) => {
    if (
      event &&
      activePointerIdRef.current !== null &&
      event.pointerId !== activePointerIdRef.current
    ) return;
    if (!drawingRef.current) return;

    drawingRef.current = false;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    flushPendingPoints();
    socket.emit(SOCKET_EVENTS.STROKE_END, { roomId, strokeId: currentStrokeId.current });
    currentStrokeId.current = "";
    pendingPointsRef.current = [];
    activePointerIdRef.current = null;
  };

  const otherCursors = useMemo(
    () => Object.values(cursors).filter((cursor) => cursor.userId !== userId),
    [cursors, userId],
  );

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={1200}
        height={700}
        className={`w-full rounded-3xl border border-fuchsia-100 bg-white shadow-sm [touch-action:none] ${disabled ? "opacity-70" : ""}`}
        aria-label="Collaborative drawing canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onLostPointerCapture={onPointerUp}
      />
      <div className="pointer-events-none absolute inset-0">
        {stickers.map((sticker) => (
          <div
            key={sticker.stickerId}
            className="absolute"
            style={{
              left: `${(sticker.x / LOGICAL_CANVAS_WIDTH) * 100}%`,
              top: `${(sticker.y / LOGICAL_CANVAS_HEIGHT) * 100}%`,
              transform: "translate(-50%, -50%)",
              fontSize: sticker.size,
              lineHeight: 1,
            }}
          >
            {sticker.value}
          </div>
        ))}
        {otherCursors.map((cursor) => (
          <div
            key={cursor.userId}
            className="absolute"
            style={{
              left: `${(cursor.x / LOGICAL_CANVAS_WIDTH) * 100}%`,
              top: `${(cursor.y / LOGICAL_CANVAS_HEIGHT) * 100}%`,
              transform: "translate(-50%, -50%)",
            }}
          >
            <span className="rounded-full bg-purple-900/80 px-2 py-0.5 text-xs text-white">
              {cursor.displayName}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
