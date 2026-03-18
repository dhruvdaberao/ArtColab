import type { BrushStyle, DrawingTool, ShapeKind } from "@cloudcanvas/shared";
import {
  Circle,
  Copy,
  Download,
  Eraser,
  Minus,
  PaintBucket,
  Pencil,
  Pipette,
  Redo2,
  Shapes,
  Slash,
  Square,
  Star,
  Trash2,
  Triangle,
  Undo2,
  ZoomIn,
} from "lucide-react";

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
  compact?: boolean;
}

const PRESET_COLORS = [
  "#191713",
  "#4d3f30",
  "#7b6447",
  "#8f6ad8",
  "#5c4a96",
  "#2f6b53",
  "#6d8c31",
  "#d9b74c",
  "#c9903b",
  "#9a4d52",
  "#cf6f7d",
  "#d9c5f4",
  "#fbf7ee",
  "#ffffff",
];
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

const toolButton =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border-2 border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-xs font-semibold text-[color:var(--text-main)] transition hover:bg-[color:var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-40 sm:text-sm";
const selectedToolButton =
  "bg-[color:var(--primary)] text-[color:var(--surface)] hover:bg-[color:var(--primary-strong)]";
const sectionClass =
  "flex flex-wrap items-center gap-2 rounded-[1.5rem] border border-[color:var(--primary)]/14 bg-[color:var(--bg-elevated)] p-2.5";
const labelClass =
  "text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)] sm:text-[11px]";

export function Toolbar({
  tool,
  setTool,
  brushStyle,
  setBrushStyle,
  strokeColor,
  setStrokeColor,
  fillColor,
  setFillColor,
  fillEnabled,
  setFillEnabled,
  size,
  setSize,
  recentColors,
  onClear,
  onUndo,
  onRedo,
  onDownload,
  onCopyImage,
  onResetView,
  canUndo,
  canRedo,
  disabled = false,
  compact = false,
}: ToolbarProps) {
  const isBrushTool = tool === "pen" || tool === "eraser";
  const isShapeTool = SHAPES.some((shape) => shape.tool === tool);

  return (
    <div
      className={`flex flex-col gap-2 rounded-[24px] border-2 border-[color:var(--border)] bg-[color:var(--surface)]/95 p-2.5 shadow-[var(--shadow)] sm:gap-3 sm:rounded-[28px] sm:p-4 ${compact ? "sm:p-3" : ""}`}
    >
      <div className="flex flex-wrap gap-2 sm:gap-3">
        <div className={`${sectionClass} flex-1`}>
          <button type="button" className={`${toolButton} ${tool === "pen" ? selectedToolButton : ""}`} onClick={() => setTool("pen")} disabled={disabled}>
            <Pencil size={16} /> Brush
          </button>
          <button type="button" className={`${toolButton} ${tool === "eraser" ? selectedToolButton : ""}`} onClick={() => setTool("eraser")} disabled={disabled}>
            <Eraser size={16} /> Eraser
          </button>
          <div className="flex flex-1 flex-wrap gap-2 rounded-[1.25rem] border border-[color:var(--primary)]/14 bg-[color:var(--surface)] p-1.5">
            <div className="flex items-center gap-1 px-2 text-[color:var(--primary)]">
              <Shapes size={14} />
              <span className={labelClass}>Shapes</span>
            </div>
            {SHAPES.map(({ tool: shapeTool, label, icon: Icon }) => (
              <button
                key={shapeTool}
                type="button"
                className={`${toolButton} min-h-9 px-2.5 py-1.5 text-[11px] sm:text-xs ${tool === shapeTool ? selectedToolButton : "bg-transparent hover:bg-[color:var(--surface-soft)]"}`}
                onClick={() => setTool(shapeTool)}
                disabled={disabled}
              >
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>
        </div>

        <div className={`${sectionClass} flex-1`}>
          <div className="flex items-center gap-3 rounded-[1.25rem] border border-[color:var(--primary)]/14 bg-[color:var(--surface)] px-3 py-2.5">
            <Pipette size={16} className="text-[color:var(--primary)]" />
            <div>
              <p className={labelClass}>Stroke</p>
              <div className="mt-1 flex items-center gap-2">
                <input type="color" value={strokeColor} onChange={(e) => setStrokeColor(e.target.value)} disabled={disabled || tool === "eraser"} className="h-9 w-9 cursor-pointer rounded-xl border-2 border-[color:var(--border)] bg-transparent p-0" />
                <div className="h-7 w-7 rounded-full border-2 border-[color:var(--border)]" style={{ backgroundColor: strokeColor }} />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setStrokeColor(preset)}
                disabled={disabled || tool === "eraser"}
                className={`h-8 w-8 rounded-full border-2 ${strokeColor === preset ? "border-[color:var(--border)] ring-2 ring-[color:var(--accent)]" : "border-[color:var(--surface)]"}`}
                style={{ backgroundColor: preset }}
                aria-label={`Use stroke color ${preset}`}
              />
            ))}
          </div>
          {!!recentColors.length && (
            <div className="flex items-center gap-2 rounded-[1.25rem] border border-[color:var(--primary)]/14 bg-[color:var(--surface)] px-3 py-2">
              <span className={labelClass}>Recent</span>
              <div className="flex gap-2">
                {recentColors.map((preset) => (
                  <button key={preset} type="button" onClick={() => setStrokeColor(preset)} className="h-6 w-6 rounded-full border border-[color:var(--border)]/20" style={{ backgroundColor: preset }} aria-label={`Recent color ${preset}`} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className={`${sectionClass} flex-1`}>
          <div className="flex flex-wrap items-center gap-2 rounded-[1.25rem] border border-[color:var(--primary)]/14 bg-[color:var(--surface)] px-3 py-2.5">
            <PaintBucket size={16} className="text-[color:var(--primary)]" />
            <label className="flex items-center gap-2 text-sm font-medium text-[color:var(--text-main)]">
              <input type="checkbox" checked={fillEnabled} onChange={(e) => setFillEnabled(e.target.checked)} disabled={disabled || !isShapeTool} className="h-4 w-4 rounded border-[color:var(--border)] text-[color:var(--primary)]" />
              Fill shapes
            </label>
            <input type="color" value={fillColor} onChange={(e) => setFillColor(e.target.value)} disabled={disabled || !isShapeTool || !fillEnabled} className="h-9 w-9 cursor-pointer rounded-xl border-2 border-[color:var(--border)] bg-transparent p-0" />
            <div className="h-7 w-7 rounded-full border-2 border-[color:var(--border)]" style={{ backgroundColor: fillEnabled && isShapeTool ? fillColor : "#ffffff" }} />
          </div>
          <div className="flex min-w-[180px] flex-1 items-center gap-3 rounded-[1.25rem] border border-[color:var(--primary)]/14 bg-[color:var(--surface)] px-3 py-2.5">
            <span className={labelClass}>Size</span>
            <input type="range" min={1} max={24} value={size} onChange={(e) => setSize(Number(e.target.value))} disabled={disabled} className="flex-1 accent-[color:var(--primary)]" />
            <span className="w-8 text-right text-sm font-semibold text-[color:var(--text-main)]">{size}</span>
          </div>
          {isBrushTool && tool !== "eraser" && (
            <div className="flex flex-wrap gap-2">
              {BRUSHES.map((b) => (
                <button key={b} type="button" className={`${toolButton} min-h-9 px-2.5 py-1.5 text-[11px] capitalize sm:text-xs ${brushStyle === b ? selectedToolButton : ""}`} onClick={() => setBrushStyle(b)} disabled={disabled}>
                  {b}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={`${sectionClass} flex-1`}>
          <button type="button" className={toolButton} onClick={onUndo} disabled={disabled || !canUndo}><Undo2 size={16} /> Undo</button>
          <button type="button" className={toolButton} onClick={onRedo} disabled={disabled || !canRedo}><Redo2 size={16} /> Redo</button>
          <button type="button" className={toolButton} onClick={onDownload} disabled={disabled}><Download size={16} /> Export</button>
          <button type="button" className={toolButton} onClick={onCopyImage} disabled={disabled}><Copy size={16} /> Copy</button>
          <button type="button" className={toolButton} onClick={onResetView} disabled={disabled}><ZoomIn size={16} /> Reset view</button>
          <button type="button" className={toolButton} onClick={onClear} disabled={disabled}><Trash2 size={16} /> Clear</button>
        </div>
      </div>
    </div>
  );
}
