import type { BrushStyle, DrawingTool, ShapeKind } from "@cloudcanvas/shared";
import { Circle, Eraser, Minus, Pencil, Redo2, Shapes, Slash, Square, Star, Triangle, Download, Copy, Trash2, PaintBucket, Pipette, ZoomIn, Undo2 } from "lucide-react";

interface ToolbarProps {
  tool: DrawingTool;
  setTool: (tool: DrawingTool) => void;
  brushStyle: BrushStyle;
  setBrushStyle: (style: BrushStyle) => void;
  strokeColor: string;
  setStrokeColor: (color: string) => void;
  fillColor: string;
  setFillColor: (color: string) => void;
  fillEnabled: boolean;
  setFillEnabled: (value: boolean) => void;
  size: number;
  setSize: (size: number) => void;
  recentColors: string[];
  onClear: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onDownload: () => void;
  onCopyImage: () => void;
  onResetView: () => void;
  canUndo: boolean;
  canRedo: boolean;
  disabled?: boolean;
}

const PRESET_COLORS = ["#111827", "#334155", "#64748b", "#2563eb", "#0ea5e9", "#0f766e", "#16a34a", "#84cc16", "#eab308", "#f97316", "#dc2626", "#db2777", "#7c3aed", "#f8fafc"];
const BRUSHES: BrushStyle[] = ["classic", "rainbow", "neon", "dotted", "spray"];
const SHAPES: Array<{ tool: ShapeKind; label: string; icon: typeof Minus }> = [
  { tool: "line", label: "Line", icon: Slash },
  { tool: "rectangle", label: "Rectangle", icon: Square },
  { tool: "square", label: "Square", icon: Square },
  { tool: "circle", label: "Circle", icon: Circle },
  { tool: "ellipse", label: "Ellipse", icon: Circle },
  { tool: "triangle", label: "Triangle", icon: Triangle },
  { tool: "star", label: "Star", icon: Star },
];

const toolButton = "inline-flex min-h-10 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40";
const selectedToolButton = "border-slate-900 bg-slate-900 text-white hover:bg-slate-800";
const sectionClass = "flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/90 p-2";

export function Toolbar({ tool, setTool, brushStyle, setBrushStyle, strokeColor, setStrokeColor, fillColor, setFillColor, fillEnabled, setFillEnabled, size, setSize, recentColors, onClear, onUndo, onRedo, onDownload, onCopyImage, onResetView, canUndo, canRedo, disabled = false }: ToolbarProps) {
  const isBrushTool = tool === "pen" || tool === "eraser";
  const isShapeTool = SHAPES.some((shape) => shape.tool === tool);

  return (
    <div className="flex flex-col gap-3 rounded-[28px] border border-slate-200 bg-white/95 p-3 shadow-sm sm:p-4">
      <div className="flex flex-wrap gap-3">
        <div className={sectionClass}>
          <button type="button" className={`${toolButton} ${tool === "pen" ? selectedToolButton : ""}`} onClick={() => setTool("pen")} disabled={disabled}><Pencil size={16} /> Brush</button>
          <button type="button" className={`${toolButton} ${tool === "eraser" ? selectedToolButton : ""}`} onClick={() => setTool("eraser")} disabled={disabled}><Eraser size={16} /> Eraser</button>
          <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-1">
            <div className="flex items-center gap-1 px-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"><Shapes size={14} /> Shapes</div>
            {SHAPES.map(({ tool: shapeTool, label, icon: Icon }) => (
              <button key={shapeTool} type="button" className={`${toolButton} min-h-9 px-2.5 py-1.5 text-xs ${tool === shapeTool ? selectedToolButton : "border-transparent bg-transparent hover:border-slate-200"}`} onClick={() => setTool(shapeTool)} disabled={disabled}><Icon size={15} /> {label}</button>
            ))}
          </div>
        </div>

        <div className={sectionClass}>
          <div className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2">
            <Pipette size={16} className="text-slate-500" />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Stroke</p>
              <div className="mt-1 flex items-center gap-2">
                <input type="color" value={strokeColor} onChange={(e) => setStrokeColor(e.target.value)} disabled={disabled || tool === "eraser"} className="h-9 w-9 cursor-pointer rounded-xl border border-slate-200 bg-transparent p-0" />
                <div className="h-7 w-7 rounded-full border border-slate-200" style={{ backgroundColor: strokeColor }} />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map((preset) => (
              <button key={preset} type="button" onClick={() => setStrokeColor(preset)} disabled={disabled || tool === "eraser"} className={`h-8 w-8 rounded-full border ${strokeColor === preset ? "border-slate-900 ring-2 ring-slate-300" : "border-white/70"}`} style={{ backgroundColor: preset }} aria-label={`Use stroke color ${preset}`} />
            ))}
          </div>
          {!!recentColors.length && <div className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2"><span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Recent</span><div className="flex gap-2">{recentColors.map((preset) => <button key={preset} type="button" onClick={() => setStrokeColor(preset)} className="h-6 w-6 rounded-full border border-slate-200" style={{ backgroundColor: preset }} aria-label={`Recent color ${preset}`} />)}</div></div>}
        </div>

        <div className={sectionClass}>
          <div className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2">
            <PaintBucket size={16} className="text-slate-500" />
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={fillEnabled} onChange={(e) => setFillEnabled(e.target.checked)} disabled={disabled || !isShapeTool} className="h-4 w-4 rounded border-slate-300 text-slate-900" />
              Fill shapes
            </label>
            <input type="color" value={fillColor} onChange={(e) => setFillColor(e.target.value)} disabled={disabled || !isShapeTool || !fillEnabled} className="h-9 w-9 cursor-pointer rounded-xl border border-slate-200 bg-transparent p-0" />
            <div className="h-7 w-7 rounded-full border border-slate-200" style={{ backgroundColor: fillEnabled && isShapeTool ? fillColor : "#ffffff" }} />
          </div>
          <div className="flex min-w-[180px] flex-1 items-center gap-3 rounded-2xl bg-white px-3 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Size</span>
            <input type="range" min={1} max={24} value={size} onChange={(e) => setSize(Number(e.target.value))} disabled={disabled} className="flex-1" />
            <span className="w-8 text-right text-sm font-semibold text-slate-700">{size}</span>
          </div>
          {isBrushTool && tool !== "eraser" && <div className="flex flex-wrap gap-2">{BRUSHES.map((b) => <button key={b} type="button" className={`${toolButton} min-h-9 px-2.5 py-1.5 text-xs capitalize ${brushStyle === b ? selectedToolButton : ""}`} onClick={() => setBrushStyle(b)} disabled={disabled}>{b}</button>)}</div>}
        </div>

        <div className={sectionClass}>
          <button type="button" className={toolButton} onClick={onUndo} disabled={disabled || !canUndo}><Undo2 size={16} /> Undo</button>
          <button type="button" className={toolButton} onClick={onRedo} disabled={disabled || !canRedo}><Redo2 size={16} /> Redo</button>
          <button type="button" className={toolButton} onClick={onResetView} disabled={disabled}><ZoomIn size={16} /> Reset view</button>
          <button type="button" className={toolButton} onClick={onClear} disabled={disabled}><Trash2 size={16} /> Clear</button>
          <button type="button" className={toolButton} onClick={onDownload} disabled={disabled}><Download size={16} /> Export</button>
          <button type="button" className={toolButton} onClick={onCopyImage} disabled={disabled}><Copy size={16} /> Copy image</button>
        </div>
      </div>
    </div>
  );
}
