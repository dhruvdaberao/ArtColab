"use client";

import { socket } from "@/lib/socket";
import { SOCKET_EVENTS } from "@cloudcanvas/shared";
import type { DrawingTool, Stroke } from "@cloudcanvas/shared";
import { nanoid } from "nanoid";
import { useEffect, useRef, useState } from "react";

const LOGICAL_CANVAS_WIDTH = 1200;
const LOGICAL_CANVAS_HEIGHT = 700;

const renderStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
  if (!stroke.points.length) return;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = stroke.tool === "eraser" ? "#ffffff" : stroke.color;
  ctx.lineWidth = stroke.size;

  if (stroke.points.length < 3) {
    const point = stroke.points[0];
    ctx.beginPath();
    ctx.arc(point.x, point.y, stroke.size / 2, 0, Math.PI * 2);
    ctx.fillStyle = stroke.tool === "eraser" ? "#ffffff" : stroke.color;
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
  ctx.restore();
};

interface CanvasBoardProps {
  roomId: string;
  userId: string;
  tool: DrawingTool;
  color: string;
  size: number;
  strokes: Stroke[];
  setStrokes: React.Dispatch<React.SetStateAction<Stroke[]>>;
  disabled?: boolean;
}

export function CanvasBoard({
  roomId,
  userId,
  tool,
  color,
  size,
  strokes,
  setStrokes,
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

  const scheduleFlush = () => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      flushPendingPoints();
      rafRef.current = null;
    });
  };

  const position = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * LOGICAL_CANVAS_WIDTH;
    const y =
      ((event.clientY - rect.top) / rect.height) * LOGICAL_CANVAS_HEIGHT;

    return {
      x: Math.min(Math.max(x, 0), LOGICAL_CANVAS_WIDTH),
      y: Math.min(Math.max(y, 0), LOGICAL_CANVAS_HEIGHT),
    };
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled || !event.isPrimary) return;

    event.preventDefault();
    drawingRef.current = true;
    activePointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = position(event);
    const strokeId = nanoid();
    currentStrokeId.current = strokeId;
    const stroke: Stroke = {
      strokeId,
      roomId,
      userId,
      tool,
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
    if (!drawingRef.current || activePointerIdRef.current !== event.pointerId)
      return;

    event.preventDefault();

    const nativeEvent = event.nativeEvent as PointerEvent;
    const coalescedEvents =
      typeof nativeEvent.getCoalescedEvents === "function"
        ? nativeEvent.getCoalescedEvents()
        : [];
    const samples = coalescedEvents.length ? coalescedEvents : [nativeEvent];

    const points = samples.map((sample) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const x =
        ((sample.clientX - rect.left) / rect.width) * LOGICAL_CANVAS_WIDTH;
      const y =
        ((sample.clientY - rect.top) / rect.height) * LOGICAL_CANVAS_HEIGHT;
      return {
        x: Math.min(Math.max(x, 0), LOGICAL_CANVAS_WIDTH),
        y: Math.min(Math.max(y, 0), LOGICAL_CANVAS_HEIGHT),
      };
    });

    setStrokes((prev) =>
      prev.map((stroke) =>
        stroke.strokeId === currentStrokeId.current
          ? { ...stroke, points: [...stroke.points, ...points] }
          : stroke,
      ),
    );

    pendingPointsRef.current.push(...points);
    scheduleFlush();
  };

  const onPointerUp = (event?: React.PointerEvent<HTMLCanvasElement>) => {
    if (
      event &&
      activePointerIdRef.current !== null &&
      event.pointerId !== activePointerIdRef.current
    )
      return;
    if (!drawingRef.current) return;
    drawingRef.current = false;

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    flushPendingPoints();

    socket.emit(SOCKET_EVENTS.STROKE_END, {
      roomId,
      strokeId: currentStrokeId.current,
    });
    currentStrokeId.current = "";
    pendingPointsRef.current = [];
    activePointerIdRef.current = null;
  };

  return (
    <canvas
      ref={canvasRef}
      width={1200}
      height={700}
      className={`w-full rounded-2xl border border-slate-200 bg-white shadow-sm transition-opacity [touch-action:none] ${tool === "pen" ? "cursor-crosshair" : "cursor-cell"} ${disabled ? "opacity-70" : ""}`}
      aria-label="Collaborative drawing canvas"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onPointerCancel={onPointerUp}
      onLostPointerCapture={onPointerUp}
    />
  );
}
