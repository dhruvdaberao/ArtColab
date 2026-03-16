'use client';

import { socket } from '@/lib/socket';
import { SOCKET_EVENTS } from '@cloudcanvas/shared';
import type { DrawingTool, Stroke } from '@cloudcanvas/shared';
import { nanoid } from 'nanoid';
import { useEffect, useRef } from 'react';

const renderStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
  if (!stroke.points.length) return;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = stroke.tool === 'eraser' ? '#ffffff' : stroke.color;
  ctx.lineWidth = stroke.size;

  if (stroke.points.length < 3) {
    const point = stroke.points[0];
    ctx.beginPath();
    ctx.arc(point.x, point.y, stroke.size / 2, 0, Math.PI * 2);
    ctx.fillStyle = stroke.tool === 'eraser' ? '#ffffff' : stroke.color;
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
}

export function CanvasBoard({ roomId, userId, tool, color, size, strokes, setStrokes }: CanvasBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const currentStrokeId = useRef<string>('');
  const pendingPointsRef = useRef<Stroke['points']>([]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    strokes.forEach((stroke) => renderStroke(context, stroke));
  }, [strokes]);

  const flushPendingPoints = () => {
    if (!pendingPointsRef.current.length || !currentStrokeId.current) return;

    const pointsToSend = pendingPointsRef.current;
    pendingPointsRef.current = [];

    socket.emit(SOCKET_EVENTS.STROKE_APPEND, {
      roomId,
      strokeId: currentStrokeId.current,
      points: pointsToSend
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
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    drawingRef.current = true;
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
      timestamp: Date.now()
    };
    setStrokes((prev) => [...prev, stroke]);
    socket.emit(SOCKET_EVENTS.STROKE_START, { roomId, stroke: { ...stroke, points: [point] } });
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const point = position(event);

    setStrokes((prev) =>
      prev.map((stroke) =>
        stroke.strokeId === currentStrokeId.current ? { ...stroke, points: [...stroke.points, point] } : stroke
      )
    );

    pendingPointsRef.current.push(point);
    scheduleFlush();
  };

  const onPointerUp = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    flushPendingPoints();

    socket.emit(SOCKET_EVENTS.STROKE_END, { roomId, strokeId: currentStrokeId.current });
    currentStrokeId.current = '';
  };

  return (
    <canvas
      ref={canvasRef}
      width={1200}
      height={700}
      className="w-full rounded-2xl border border-slate-200 bg-white shadow-sm [touch-action:none]"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    />
  );
}
