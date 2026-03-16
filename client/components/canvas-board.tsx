'use client';

import { socket } from '@/lib/socket';
import type { DrawingTool, Stroke } from '@cloudcanvas/shared';
import { nanoid } from 'nanoid';
import { useEffect, useRef } from 'react';

const renderStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
  if (stroke.points.length < 1) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = stroke.tool === 'eraser' ? '#ffffff' : stroke.color;
  ctx.lineWidth = stroke.size;
  ctx.beginPath();
  ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
  stroke.points.slice(1).forEach((point) => {
    ctx.lineTo(point.x, point.y);
  });
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    strokes.forEach((stroke) => renderStroke(context, stroke));
  }, [strokes]);

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
    socket.emit('draw_start', { roomId, stroke: { ...stroke, points: [point] } });
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const point = position(event);
    setStrokes((prev) =>
      prev.map((stroke) =>
        stroke.strokeId === currentStrokeId.current ? { ...stroke, points: [...stroke.points, point] } : stroke
      )
    );
    socket.emit('draw_move', { roomId, strokeId: currentStrokeId.current, points: [point] });
  };

  const onPointerUp = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    socket.emit('draw_end', { roomId, strokeId: currentStrokeId.current });
    currentStrokeId.current = '';
  };

  return (
    <canvas
      ref={canvasRef}
      width={1200}
      height={700}
      className="w-full rounded-2xl border border-slate-200 bg-white shadow-sm"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    />
  );
}
