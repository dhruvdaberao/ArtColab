'use client';

import { socket } from '@/lib/socket';
import { SOCKET_EVENTS } from '@cloudcanvas/shared';
import type { BrushStyle, CursorPayload, DrawingTool, Stroke } from '@cloudcanvas/shared';
import { nanoid } from 'nanoid';
import { useEffect, useMemo, useRef, useState } from 'react';

const LOGICAL_CANVAS_WIDTH = 1200;
const LOGICAL_CANVAS_HEIGHT = 700;
const MIN_SCALE = 1;
const MAX_SCALE = 3;

type Viewport = { scale: number; offsetX: number; offsetY: number };

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const getInitials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || '?';

const renderStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
  if (!stroke.points.length) return;
  const brushStyle = stroke.brushStyle ?? 'classic';
  ctx.save();
  ctx.lineCap = brushStyle === 'dotted' ? 'butt' : 'round';
  ctx.lineJoin = 'round';
  const strokeColor = stroke.tool === 'eraser' ? '#ffffff' : stroke.color;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = stroke.size;
  if (brushStyle === 'dotted') ctx.setLineDash([1, Math.max(6, stroke.size * 1.35)]);
  if (brushStyle === 'neon') { ctx.shadowColor = strokeColor; ctx.shadowBlur = Math.max(4, stroke.size * 1.5); }
  if (stroke.points.length < 3) { const point = stroke.points[0]; ctx.beginPath(); ctx.arc(point.x, point.y, stroke.size / 2, 0, Math.PI * 2); ctx.fillStyle = strokeColor; ctx.fill(); ctx.restore(); return; }
  ctx.beginPath(); ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
  for (let i = 1; i < stroke.points.length - 1; i += 1) { const current = stroke.points[i]; const next = stroke.points[i + 1]; const midX = (current.x + next.x) / 2; const midY = (current.y + next.y) / 2; if (brushStyle === 'rainbow' && stroke.tool !== 'eraser') ctx.strokeStyle = `hsl(${(i * 18) % 360} 95% 60%)`; ctx.quadraticCurveTo(current.x, current.y, midX, midY); }
  const last = stroke.points[stroke.points.length - 1]; ctx.lineTo(last.x, last.y); ctx.stroke();
  if (brushStyle === 'spray' && stroke.tool !== 'eraser') { for (const point of stroke.points) { for (let i = 0; i < Math.max(4, Math.floor(stroke.size)); i += 1) { const offsetX = (Math.random() - 0.5) * stroke.size * 2.1; const offsetY = (Math.random() - 0.5) * stroke.size * 2.1; ctx.fillStyle = stroke.color; ctx.fillRect(point.x + offsetX, point.y + offsetY, 1.5, 1.5); } } }
  ctx.restore();
};

interface CanvasBoardProps { roomId: string; userId: string; displayName: string; avatarUrl?: string; tool: DrawingTool; brushStyle: BrushStyle; color: string; size: number; strokes: Stroke[]; cursors: Record<string, CursorPayload>; setStrokes: React.Dispatch<React.SetStateAction<Stroke[]>>; disabled?: boolean; }

export function CanvasBoard({ roomId, userId, displayName, avatarUrl, tool, brushStyle, color, size, strokes, cursors, setStrokes, disabled = false }: CanvasBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null); const surfaceRef = useRef<HTMLDivElement | null>(null); const drawingRef = useRef(false); const currentStrokeId = useRef(''); const pendingPointsRef = useRef<Stroke['points']>([]); const rafRef = useRef<number | null>(null); const activePointerIdRef = useRef<number | null>(null); const gestureRef = useRef<{ firstId: number; secondId: number; startDistance: number; startScale: number; startOffsetX: number; startOffsetY: number; startCenterX: number; startCenterY: number } | null>(null); const pointersRef = useRef(new Map<number, { x: number; y: number }>()); const emitCursorRef = useRef<number | null>(null);
  const [canvasVersion, setCanvasVersion] = useState(0); const [viewport, setViewport] = useState<Viewport>({ scale: 1, offsetX: 0, offsetY: 0 });

  useEffect(() => { const canvas = canvasRef.current; if (!canvas) return; const syncCanvasResolution = () => { const rect = canvas.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1; const nextWidth = Math.max(1, Math.round(rect.width * dpr)); const nextHeight = Math.max(1, Math.round(rect.height * dpr)); if (canvas.width !== nextWidth || canvas.height !== nextHeight) { canvas.width = nextWidth; canvas.height = nextHeight; setCanvasVersion((version) => version + 1); } }; syncCanvasResolution(); const observer = new ResizeObserver(syncCanvasResolution); observer.observe(canvas); window.addEventListener('resize', syncCanvasResolution); return () => { observer.disconnect(); window.removeEventListener('resize', syncCanvasResolution); }; }, []);
  useEffect(() => { const canvas = canvasRef.current; if (!canvas) return; const context = canvas.getContext('2d'); if (!context) return; const scaleX = canvas.width / LOGICAL_CANVAS_WIDTH; const scaleY = canvas.height / LOGICAL_CANVAS_HEIGHT; context.setTransform(1,0,0,1,0,0); context.clearRect(0,0,canvas.width,canvas.height); context.setTransform(scaleX,0,0,scaleY,0,0); context.fillStyle='#ffffff'; context.fillRect(0,0,LOGICAL_CANVAS_WIDTH,LOGICAL_CANVAS_HEIGHT); strokes.forEach((stroke)=>renderStroke(context, stroke)); }, [strokes, canvasVersion]);
  useEffect(() => () => { if (emitCursorRef.current) cancelAnimationFrame(emitCursorRef.current); }, []);

  const flushPendingPoints = () => { if (!pendingPointsRef.current.length || !currentStrokeId.current) return; const pointsToSend = pendingPointsRef.current; pendingPointsRef.current = []; socket.emit(SOCKET_EVENTS.STROKE_APPEND, { roomId, strokeId: currentStrokeId.current, points: pointsToSend }); };
  const normalizeViewport = (next: Viewport) => { const surface = surfaceRef.current; if (!surface) return next; const rect = surface.getBoundingClientRect(); const scaledWidth = rect.width * next.scale; const scaledHeight = rect.height * next.scale; const maxOffsetX = Math.max(0, (scaledWidth - rect.width) / 2); const maxOffsetY = Math.max(0, (scaledHeight - rect.height) / 2); return { scale: clamp(next.scale, MIN_SCALE, MAX_SCALE), offsetX: clamp(next.offsetX, -maxOffsetX, maxOffsetX), offsetY: clamp(next.offsetY, -maxOffsetY, maxOffsetY) }; };
  const toCanvasPoint = (clientX: number, clientY: number) => { const rect = surfaceRef.current?.getBoundingClientRect(); if (!rect) return { x: 0, y: 0 }; const normalizedX = (clientX - rect.left - viewport.offsetX - rect.width / 2) / viewport.scale + rect.width / 2; const normalizedY = (clientY - rect.top - viewport.offsetY - rect.height / 2) / viewport.scale + rect.height / 2; return { x: clamp((normalizedX / rect.width) * LOGICAL_CANVAS_WIDTH, 0, LOGICAL_CANVAS_WIDTH), y: clamp((normalizedY / rect.height) * LOGICAL_CANVAS_HEIGHT, 0, LOGICAL_CANVAS_HEIGHT) }; };
  const queueCursorEmit = (point: { x: number; y: number }, drawing: boolean) => { if (emitCursorRef.current) cancelAnimationFrame(emitCursorRef.current); emitCursorRef.current = requestAnimationFrame(() => { socket.emit(SOCKET_EVENTS.CURSOR_UPDATE, { roomId, userId, displayName, avatarUrl, x: point.x, y: point.y, drawing }); emitCursorRef.current = null; }); };
  const scheduleFlush = () => { if (rafRef.current) return; rafRef.current = requestAnimationFrame(() => { flushPendingPoints(); rafRef.current = null; }); };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return; pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (event.pointerType === 'touch' && pointersRef.current.size === 2) { const [first, second] = Array.from(pointersRef.current.entries()); gestureRef.current = { firstId: first[0], secondId: second[0], startDistance: Math.hypot(second[1].x - first[1].x, second[1].y - first[1].y), startScale: viewport.scale, startOffsetX: viewport.offsetX, startOffsetY: viewport.offsetY, startCenterX: (first[1].x + second[1].x) / 2, startCenterY: (first[1].y + second[1].y) / 2 }; drawingRef.current = false; activePointerIdRef.current = null; return; }
    if (event.pointerType === 'touch' && pointersRef.current.size > 1) return;
    const point = toCanvasPoint(event.clientX, event.clientY); queueCursorEmit(point, false); event.preventDefault(); drawingRef.current = true; activePointerIdRef.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); const strokeId = nanoid(); currentStrokeId.current = strokeId; const stroke: Stroke = { strokeId, roomId, userId, tool, brushStyle, color, size, points: [point], timestamp: Date.now() }; setStrokes((prev) => [...prev, stroke]); socket.emit(SOCKET_EVENTS.STROKE_START, { roomId, stroke: { ...stroke, points: [point] } }); queueCursorEmit(point, true);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (gestureRef.current) { const first = pointersRef.current.get(gestureRef.current.firstId); const second = pointersRef.current.get(gestureRef.current.secondId); if (!first || !second) return; event.preventDefault(); const currentDistance = Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)); const centerX = (first.x + second.x) / 2; const centerY = (first.y + second.y) / 2; const nextScale = clamp(gestureRef.current.startScale * (currentDistance / gestureRef.current.startDistance), MIN_SCALE, MAX_SCALE); setViewport(normalizeViewport({ scale: nextScale, offsetX: gestureRef.current.startOffsetX + (centerX - gestureRef.current.startCenterX), offsetY: gestureRef.current.startOffsetY + (centerY - gestureRef.current.startCenterY) })); return; }
    const point = toCanvasPoint(event.clientX, event.clientY); queueCursorEmit(point, drawingRef.current);
    if (!drawingRef.current || activePointerIdRef.current !== event.pointerId) return; event.preventDefault(); setStrokes((prev) => prev.map((stroke) => stroke.strokeId === currentStrokeId.current ? { ...stroke, points: [...stroke.points, point] } : stroke)); pendingPointsRef.current.push(point); scheduleFlush();
  };

  const finishPointer = (event?: React.PointerEvent<HTMLCanvasElement>) => { if (event) pointersRef.current.delete(event.pointerId); if (gestureRef.current && pointersRef.current.size < 2) gestureRef.current = null; if (event && activePointerIdRef.current !== null && event.pointerId !== activePointerIdRef.current) return; if (!drawingRef.current) return; drawingRef.current = false; if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; } flushPendingPoints(); socket.emit(SOCKET_EVENTS.STROKE_END, { roomId, strokeId: currentStrokeId.current }); currentStrokeId.current = ''; pendingPointsRef.current = []; activePointerIdRef.current = null; };

  const otherCursors = useMemo(() => Object.values(cursors).filter((cursor) => cursor.userId !== userId), [cursors, userId]);

  return <div className="space-y-2"><div className="flex justify-end">{viewport.scale > 1 && <button type="button" className="rounded-full border-2 border-black bg-[#fffdf7] px-3 py-1 text-xs font-semibold" onClick={() => setViewport({ scale: 1, offsetX: 0, offsetY: 0 })}>Reset view</button>}</div><div ref={surfaceRef} className="relative overflow-hidden rounded-3xl border-2 border-black bg-white shadow-sm [touch-action:none]">
    <div className="relative" style={{ transform: `translate(${viewport.offsetX}px, ${viewport.offsetY}px) scale(${viewport.scale})`, transformOrigin: 'center center' }}>
      <canvas ref={canvasRef} width={1200} height={700} className={`block w-full ${disabled ? 'opacity-70' : ''}`} aria-label="Collaborative drawing canvas" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={finishPointer} onPointerCancel={finishPointer} onLostPointerCapture={finishPointer} />
      <div className="pointer-events-none absolute inset-0">{otherCursors.map((cursor) => { const idle = Date.now() - cursor.updatedAt > 2200; return <div key={cursor.userId} className={`absolute transition-opacity ${idle ? 'opacity-45' : 'opacity-100'}`} style={{ left: `${(cursor.x / LOGICAL_CANVAS_WIDTH) * 100}%`, top: `${(cursor.y / LOGICAL_CANVAS_HEIGHT) * 100}%`, transform: 'translate(-50%, -50%)' }}><div className="flex flex-col items-center gap-1"><div className={`grid h-10 w-10 place-items-center overflow-hidden rounded-full border-2 border-black bg-[#f4efe2] text-xs font-bold text-slate-900 shadow ${cursor.drawing ? 'ring-2 ring-[#e7d36f]' : ''}`}>{cursor.avatarUrl ? <img src={cursor.avatarUrl} alt={cursor.displayName} className="h-full w-full object-cover" /> : getInitials(cursor.displayName)}</div><span className="rounded-full border border-black bg-[#fffdf7] px-2 py-0.5 text-[11px] font-semibold text-slate-800">{cursor.displayName}</span></div></div>; })}</div>
    </div></div></div>;
}
