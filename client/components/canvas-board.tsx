'use client';

import { socket } from '@/lib/socket';
import { SOCKET_EVENTS } from '@cloudcanvas/shared';
import type { BrushStyle, CursorPayload, DrawingTool, ShapeKind, Stroke } from '@cloudcanvas/shared';
import { nanoid } from 'nanoid';
import { Move, ZoomIn, ZoomOut } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

const LOGICAL_CANVAS_WIDTH = 1200;
const LOGICAL_CANVAS_HEIGHT = 700;
const MIN_SCALE = 1;
const MAX_SCALE = 3;
const SHAPE_TOOLS: ShapeKind[] = ['line', 'rectangle', 'square', 'circle', 'ellipse', 'triangle', 'star'];

type Viewport = { scale: number; offsetX: number; offsetY: number };
type PointerMap = Map<number, { x: number; y: number }>;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const distanceBetween = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(b.x - a.x, b.y - a.y);
const midpoint = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const isShapeTool = (tool: DrawingTool): tool is ShapeKind => SHAPE_TOOLS.includes(tool as ShapeKind);
const getInitials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || '?';

const buildShapePath = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
  const shape = stroke.shape;
  if (!shape) return false;
  const { start, end, kind } = shape;
  let x = start.x;
  let y = start.y;
  let width = end.x - start.x;
  let height = end.y - start.y;

  if (kind === 'square' || kind === 'circle') {
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
  if (kind === 'line') {
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
  } else if (kind === 'rectangle' || kind === 'square') {
    ctx.rect(left, top, absWidth, absHeight);
  } else if (kind === 'circle' || kind === 'ellipse') {
    ctx.ellipse(centerX, centerY, Math.max(1, absWidth / 2), Math.max(1, absHeight / 2), 0, 0, Math.PI * 2);
  } else if (kind === 'triangle') {
    ctx.moveTo(centerX, top);
    ctx.lineTo(left + absWidth, top + absHeight);
    ctx.lineTo(left, top + absHeight);
    ctx.closePath();
  } else if (kind === 'star') {
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

const renderStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke, preview = false) => {
  if (stroke.shape) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = stroke.size;
    ctx.strokeStyle = stroke.tool === 'eraser' ? '#ffffff' : stroke.color;
    if (buildShapePath(ctx, stroke)) {
      if (stroke.fillColor && stroke.tool !== 'eraser') {
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

interface CanvasBoardProps {
  roomId: string; userId: string; displayName: string; avatarUrl?: string; tool: DrawingTool; brushStyle: BrushStyle; color: string; fillColor: string; fillEnabled: boolean; size: number; strokes: Stroke[]; cursors: Record<string, CursorPayload>; setStrokes: React.Dispatch<React.SetStateAction<Stroke[]>>; disabled?: boolean; resetViewSignal: number;
}

export function CanvasBoard({ roomId, userId, displayName, avatarUrl, tool, brushStyle, color, fillColor, fillEnabled, size, strokes, cursors, setStrokes, disabled = false, resetViewSignal }: CanvasBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const drawingRef = useRef(false);
  const currentStrokeId = useRef('');
  const pendingPointsRef = useRef<Stroke['points']>([]);
  const activePointerIdRef = useRef<number | null>(null);
  const emitCursorRef = useRef<number | null>(null);
  const pointersRef = useRef<PointerMap>(new Map());
  const panStartRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const gestureRef = useRef<{ firstId: number; secondId: number; startDistance: number; startScale: number; startOffsetX: number; startOffsetY: number; startCenterX: number; startCenterY: number } | null>(null);
  const [canvasVersion, setCanvasVersion] = useState(0);
  const [viewport, setViewport] = useState<Viewport>({ scale: 1, offsetX: 0, offsetY: 0 });
  const [previewStroke, setPreviewStroke] = useState<Stroke | null>(null);

  const queueCursorEmit = (point: { x: number; y: number }, drawing: boolean) => {
    if (emitCursorRef.current) cancelAnimationFrame(emitCursorRef.current);
    emitCursorRef.current = requestAnimationFrame(() => {
      socket.emit(SOCKET_EVENTS.CURSOR_UPDATE, { roomId, userId, displayName, avatarUrl, x: point.x, y: point.y, drawing, updatedAt: Date.now() });
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
    return { scale: clamp(next.scale, MIN_SCALE, MAX_SCALE), offsetX: clamp(next.offsetX, -maxOffsetX, maxOffsetX), offsetY: clamp(next.offsetY, -maxOffsetY, maxOffsetY) };
  };

  const getCanvasPoint = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * LOGICAL_CANVAS_WIDTH;
    const y = ((clientY - rect.top) / rect.height) * LOGICAL_CANVAS_HEIGHT;
    return { x: clamp(x, 0, LOGICAL_CANVAS_WIDTH), y: clamp(y, 0, LOGICAL_CANVAS_HEIGHT) };
  };

  const zoomAtPoint = (clientX: number, clientY: number, nextScale: number) => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const rect = surface.getBoundingClientRect();
    setViewport((current) => {
      const clampedScale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
      const pointerX = clientX - rect.left;
      const pointerY = clientY - rect.top;
      const contentX = (pointerX - rect.width / 2 - current.offsetX) / current.scale;
      const contentY = (pointerY - rect.height / 2 - current.offsetY) / current.scale;
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
    socket.emit(SOCKET_EVENTS.STROKE_APPEND, { roomId, strokeId: currentStrokeId.current, points: pointsToSend });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const syncCanvasResolution = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const nextWidth = Math.max(1, Math.round(rect.width * dpr));
      const nextHeight = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== nextWidth || canvas.height !== nextHeight) { canvas.width = nextWidth; canvas.height = nextHeight; setCanvasVersion((version) => version + 1); }
    };
    syncCanvasResolution();
    const observer = new ResizeObserver(syncCanvasResolution);
    observer.observe(canvas);
    window.addEventListener('resize', syncCanvasResolution);
    return () => { observer.disconnect(); window.removeEventListener('resize', syncCanvasResolution); };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const scaleX = canvas.width / LOGICAL_CANVAS_WIDTH;
    const scaleY = canvas.height / LOGICAL_CANVAS_HEIGHT;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, LOGICAL_CANVAS_WIDTH, LOGICAL_CANVAS_HEIGHT);
    strokes.forEach((stroke) => renderStroke(context, stroke));
    if (previewStroke) renderStroke(context, previewStroke, true);
  }, [strokes, previewStroke, canvasVersion]);

  useEffect(() => () => { if (emitCursorRef.current) cancelAnimationFrame(emitCursorRef.current); }, []);
  useEffect(() => { setViewport({ scale: 1, offsetX: 0, offsetY: 0 }); }, [resetViewSignal]);

  const viewportStyle = useMemo(() => ({ transform: `translate(${viewport.offsetX}px, ${viewport.offsetY}px) scale(${viewport.scale})`, transformOrigin: 'center center' as const }), [viewport]);

  const startFreehand = (point: { x: number; y: number }) => {
    const strokeId = nanoid();
    const stroke: Stroke = { strokeId, roomId, userId, tool, brushStyle, color, size, points: [point], fillColor: null, timestamp: Date.now() };
    drawingRef.current = true;
    currentStrokeId.current = strokeId;
    pendingPointsRef.current = [];
    setStrokes((prev) => [...prev, stroke]);
    socket.emit(SOCKET_EVENTS.STROKE_START, { roomId, stroke: { ...stroke, points: [point] } });
  };

  const startShape = (point: { x: number; y: number }) => {
    drawingRef.current = true;
    setPreviewStroke({ strokeId: nanoid(), roomId, userId, tool, color, fillColor: fillEnabled ? fillColor : null, size, points: [], shape: { kind: tool as ShapeKind, start: point, end: point }, timestamp: Date.now() });
  };

  const finishStroke = () => {
    if (drawingRef.current) flushPendingPoints();
    drawingRef.current = false;
    if (currentStrokeId.current) socket.emit(SOCKET_EVENTS.STROKE_END, { roomId, strokeId: currentStrokeId.current });
    currentStrokeId.current = '';
    pendingPointsRef.current = [];
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    const point = getCanvasPoint(event.clientX, event.clientY);
    if (!point) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointersRef.current.size === 2) {
      const [first, second] = Array.from(pointersRef.current.entries());
      const center = midpoint(first[1], second[1]);
      gestureRef.current = { firstId: first[0], secondId: second[0], startDistance: distanceBetween(first[1], second[1]), startScale: viewport.scale, startOffsetX: viewport.offsetX, startOffsetY: viewport.offsetY, startCenterX: center.x, startCenterY: center.y };
      drawingRef.current = false;
      setPreviewStroke(null);
      return;
    }

    if (viewport.scale > 1 && tool !== 'pen' && tool !== 'eraser' && !isShapeTool(tool)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointerIdRef.current = event.pointerId;

    if (viewport.scale > 1 && event.pointerType !== 'touch' && event.button === 1) {
      panStartRef.current = { x: event.clientX, y: event.clientY, offsetX: viewport.offsetX, offsetY: viewport.offsetY };
      return;
    }

    if (viewport.scale > 1 && event.pointerType === 'touch' && !isShapeTool(tool) && tool !== 'pen' && tool !== 'eraser') {
      panStartRef.current = { x: event.clientX, y: event.clientY, offsetX: viewport.offsetX, offsetY: viewport.offsetY };
      return;
    }

    if (isShapeTool(tool)) startShape(point);
    else startFreehand(point);
    queueCursorEmit(point, true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const point = getCanvasPoint(event.clientX, event.clientY);
    if (!point) return;
    if (pointersRef.current.has(event.pointerId)) pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (gestureRef.current) {
      const first = pointersRef.current.get(gestureRef.current.firstId);
      const second = pointersRef.current.get(gestureRef.current.secondId);
      if (!first || !second) return;
      const nextDistance = distanceBetween(first, second);
      const center = midpoint(first, second);
      setViewport(normalizeViewport({
        scale: clamp((nextDistance / gestureRef.current.startDistance) * gestureRef.current.startScale, MIN_SCALE, MAX_SCALE),
        offsetX: gestureRef.current.startOffsetX + (center.x - gestureRef.current.startCenterX),
        offsetY: gestureRef.current.startOffsetY + (center.y - gestureRef.current.startCenterY),
      }));
      return;
    }

    if (panStartRef.current && activePointerIdRef.current === event.pointerId) {
      setViewport(normalizeViewport({ scale: viewport.scale, offsetX: panStartRef.current.offsetX + (event.clientX - panStartRef.current.x), offsetY: panStartRef.current.offsetY + (event.clientY - panStartRef.current.y) }));
      return;
    }

    queueCursorEmit(point, drawingRef.current);
    if (!drawingRef.current || activePointerIdRef.current !== event.pointerId) return;

    if (previewStroke?.shape) {
      setPreviewStroke((current) => current && current.shape ? { ...current, shape: { ...current.shape, end: point } } : current);
      return;
    }

    pendingPointsRef.current.push(point);
    setStrokes((prev) => prev.map((stroke) => stroke.strokeId === currentStrokeId.current ? { ...stroke, points: [...stroke.points, point] } : stroke));
    if (pendingPointsRef.current.length >= 4) flushPendingPoints();
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const point = getCanvasPoint(event.clientX, event.clientY);
    pointersRef.current.delete(event.pointerId);
    if (gestureRef.current && pointersRef.current.size < 2) gestureRef.current = null;
    if (panStartRef.current && activePointerIdRef.current === event.pointerId) {
      panStartRef.current = null;
      activePointerIdRef.current = null;
      return;
    }
    if (!point) return;

    if (previewStroke?.shape && activePointerIdRef.current === event.pointerId) {
      const committed: Stroke = { ...previewStroke, shape: { ...previewStroke.shape, end: point }, timestamp: Date.now() };
      setPreviewStroke(null);
      setStrokes((prev) => [...prev, committed]);
      socket.emit(SOCKET_EVENTS.STROKE_START, { roomId, stroke: committed });
      socket.emit(SOCKET_EVENTS.STROKE_END, { roomId, strokeId: committed.strokeId });
      drawingRef.current = false;
      activePointerIdRef.current = null;
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
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-500 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700"><Move size={14} /> Pan with two fingers or middle mouse</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700"><ZoomIn size={14} /> {Math.round(viewport.scale * 100)}%</span>
        </div>
        <div className="flex items-center gap-2 text-slate-500"><ZoomOut size={14} /> Pinch or Ctrl/Cmd + wheel to zoom</div>
      </div>
      <div
        ref={surfaceRef}
        className="relative overflow-hidden rounded-[30px] border border-slate-200 bg-slate-100 shadow-sm"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        style={{ touchAction: 'none' }}
      >
        <div style={viewportStyle} className="relative aspect-[12/7] w-full">
          <canvas ref={canvasRef} className="h-full w-full rounded-[30px] bg-white" />
          <div className="pointer-events-none absolute inset-0">
            {Object.values(cursors).filter((cursor) => cursor.userId !== userId && Date.now() - cursor.updatedAt < 4000).map((cursor) => (
              <div key={cursor.userId} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${(cursor.x / LOGICAL_CANVAS_WIDTH) * 100}%`, top: `${(cursor.y / LOGICAL_CANVAS_HEIGHT) * 100}%` }}>
                <div className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm">{getInitials(cursor.displayName)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
