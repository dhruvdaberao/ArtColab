import type { BrushStyle, DrawingTool, ShapeKind } from "@cloudcanvas/shared";
import {
  Circle,
  Copy,
  Download,
  Eraser,
  Minus,
  PaintBucket,
  Pencil,
  Plus,
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
import { useEffect, useMemo, useRef, useState } from "react";

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
  "#111111",
  "#ffd84d",
  "#1c7dd7",
  "#ff5d5d",
  "#1fb76a",
  "#fb923c",
  "#ec4899",
  "#fff7df",
];
const BRUSHES: Array<{ id: BrushStyle; label: string }> = [
  { id: "classic", label: "Classic" },
  { id: "crayon", label: "Crayon" },
  { id: "neon", label: "Neon" },
  { id: "spray", label: "Spray" },
  { id: "dotted", label: "Dotted" },
];
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
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border-2 border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-xs font-black text-[color:var(--text-main)] shadow-[0_4px_0_rgba(26,26,26,0.08)] transition hover:-translate-y-0.5 hover:bg-[color:var(--surface-soft)] hover:shadow-[0_6px_0_rgba(26,26,26,0.08)] disabled:cursor-not-allowed disabled:opacity-40 sm:text-sm";
const selectedToolButton =
  "bg-[color:var(--brand-blue)] text-[color:var(--surface)] shadow-[0_5px_0_rgba(26,26,26,0.16)]";
const sectionClass =
  "flex flex-wrap items-center gap-2 rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-2.5";
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
  const [shapePanelOpen, setShapePanelOpen] = useState(false);
  const customColorInputRef = useRef<HTMLInputElement | null>(null);
  const isBrushTool = tool === "pen" || tool === "eraser";
  const isShapeTool = SHAPES.some((shape) => shape.tool === tool);
  const commonToolButtons = useMemo(
    () => [
      { id: "pen", label: "Brush", Icon: Pencil },
      { id: "eraser", label: "Eraser", Icon: Eraser },
      { id: "fill", label: "Fill", Icon: PaintBucket },
    ] as const,
    [],
  );

  useEffect(() => {
    if (!compact || !isShapeTool) return;
    setShapePanelOpen(false);
  }, [compact, isShapeTool]);

  const colorTarget = tool === "fill" ? fillColor : strokeColor;
  const setActiveColor = (value: string) => {
    if (tool === "fill") {
      setFillColor(value);
      setFillEnabled(true);
      return;
    }
    setStrokeColor(value);
  };

  const utilityButtons = (
    <div className="grid gap-2 min-[480px]:grid-cols-2 xl:grid-cols-1">
      <button type="button" className={toolButton} onClick={onUndo} disabled={disabled || !canUndo}><Undo2 size={16} /> Undo</button>
      <button type="button" className={toolButton} onClick={onRedo} disabled={disabled || !canRedo}><Redo2 size={16} /> Redo</button>
      <button type="button" className={toolButton} onClick={onDownload} disabled={disabled}><Download size={16} /> Export</button>
      <button type="button" className={toolButton} onClick={onResetView} disabled={disabled}><ZoomIn size={16} /> Reset view</button>
      <button type="button" className={toolButton} onClick={onCopyImage} disabled={disabled}><Copy size={16} /> Copy</button>
      <button type="button" className={`${toolButton} bg-[color:var(--brand-red)] text-white hover:bg-[color:var(--brand-red)]`} onClick={onClear} disabled={disabled}><Trash2 size={16} /> Clear</button>
    </div>
  );

  return (
    <div className={`flex flex-col gap-2 rounded-[24px] border-2 border-[color:var(--border)] bg-[color:var(--surface)] p-2.5 shadow-[var(--shadow)] sm:gap-3 sm:rounded-[28px] sm:p-4 ${compact ? "sm:p-3" : ""}`}>
      <div className={`grid gap-2 sm:gap-3 ${compact ? "xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]" : "2xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)_minmax(0,0.8fr)]"}`}>
        <div className={`${sectionClass} min-w-0 flex-col items-stretch`}>
          <div className="flex flex-wrap items-center gap-2">
            {commonToolButtons.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                className={`${toolButton} ${tool === id ? selectedToolButton : ""}`}
                onClick={() => {
                  if (id === "fill") setFillEnabled(true);
                  setTool(id);
                }}
                disabled={disabled}
              >
                <Icon size={16} /> {label}
              </button>
            ))}
            <button
              type="button"
              className={`${toolButton} ${isShapeTool || shapePanelOpen ? selectedToolButton : ""}`}
              onClick={() => setShapePanelOpen((value) => !value)}
              disabled={disabled}
            >
              <Shapes size={16} /> Shapes
            </button>
          </div>

          <div className={`grid gap-2 ${!compact || shapePanelOpen ? 'lg:grid-cols-2' : ''}`}>
            {(!compact || shapePanelOpen) && (
              <div className="rounded-[1.25rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-2.5">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className={labelClass}>Shapes</span>
                  {compact && <span className="text-[11px] text-[color:var(--text-muted)]">Pick one shape</span>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {SHAPES.map(({ tool: shapeTool, label, icon: Icon }) => (
                    <button
                      key={shapeTool}
                      type="button"
                      className={`${toolButton} min-h-9 px-2.5 py-1.5 text-[11px] sm:text-xs ${tool === shapeTool ? selectedToolButton : "bg-transparent hover:bg-[color:var(--surface-soft)]"}`}
                      onClick={() => {
                        setTool(shapeTool);
                        if (compact) setShapePanelOpen(false);
                      }}
                      disabled={disabled}
                    >
                      <Icon size={15} /> {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isBrushTool && tool !== 'eraser' && (
              <div className="rounded-[1.25rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-2.5">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className={labelClass}>Brush types</span>
                  <span className="text-[11px] text-[color:var(--text-muted)]">Affects stroke texture</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {BRUSHES.map((b) => (
                    <button key={b.id} type="button" className={`${toolButton} min-h-9 px-2.5 py-1.5 text-[11px] sm:text-xs ${brushStyle === b.id ? selectedToolButton : ''}`} onClick={() => setBrushStyle(b.id)} disabled={disabled}>
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-3 rounded-[1.25rem] border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2.5 sm:flex-nowrap">
            <span className={labelClass}>Size</span>
            <input type="range" min={1} max={24} value={size} onChange={(e) => setSize(Number(e.target.value))} disabled={disabled} className="min-w-[120px] flex-1 accent-[color:var(--brand-green)]" />
            <span className="w-12 rounded-full border border-[color:var(--border)] bg-[color:var(--accent)] px-2 py-1 text-center text-sm font-black text-[color:var(--text-main)]">{size}</span>
          </div>
        </div>

        <div className={`${sectionClass} min-w-0 flex-col items-stretch`}>
          <div className="flex items-center justify-between gap-2 rounded-[1.25rem] border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2.5">
            <div className="min-w-0">
              <p className={labelClass}>{tool === "fill" ? "Fill color" : "Selected color"}</p>
              <p className="mt-1 truncate text-sm font-black text-[color:var(--text-main)]">{colorTarget.toUpperCase()}</p>
            </div>
            <button
              type="button"
              className="h-11 w-11 shrink-0 rounded-full border-2 border-[color:var(--border)] shadow-sm"
              style={{ backgroundColor: colorTarget }}
              aria-label="Selected color preview"
              onClick={() => customColorInputRef.current?.click()}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map((preset) => {
              const selected = colorTarget.toLowerCase() === preset.toLowerCase();
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setActiveColor(preset)}
                  disabled={disabled || tool === "eraser"}
                  className={`h-10 w-10 rounded-full border-2 transition ${selected ? "border-[color:var(--border)] ring-4 ring-[#dff0ff]" : "border-[color:var(--border)]/30"}`}
                  style={{ backgroundColor: preset }}
                  aria-label={`Use color ${preset}`}
                />
              );
            })}
            <button
              type="button"
              className="inline-flex min-h-10 items-center justify-center rounded-full border-2 border-[color:var(--border)] bg-[color:var(--accent)] px-3 text-[11px] font-black text-[color:var(--text-main)]"
              onClick={() => customColorInputRef.current?.click()}
              disabled={disabled || tool === "eraser"}
            >
              <Plus size={14} className="mr-1" /> Custom color
            </button>
            <input
              ref={customColorInputRef}
              type="color"
              value={colorTarget}
              onChange={(e) => setActiveColor(e.target.value)}
              disabled={disabled || tool === "eraser"}
              className="sr-only"
            />
          </div>

          {!!recentColors.length && !compact && (
            <div className="flex flex-wrap items-center gap-2 rounded-[1.25rem] border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2">
              <span className={labelClass}>Recent</span>
              <div className="flex flex-wrap gap-2">
                {recentColors.map((preset) => (
                  <button key={preset} type="button" onClick={() => setActiveColor(preset)} className="h-7 w-7 rounded-full border border-[color:var(--border)]/30" style={{ backgroundColor: preset }} aria-label={`Recent color ${preset}`} />
                ))}
              </div>
            </div>
          )}

          <div className="rounded-[1.25rem] border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2.5 text-sm text-[color:var(--text-main)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-black">Shape fill</p>
                <p className="text-xs text-[color:var(--text-muted)]">Closed shapes can use the current fill color.</p>
              </div>
              <label className="inline-flex items-center gap-2 text-sm font-medium text-[color:var(--text-main)]">
                <input type="checkbox" checked={fillEnabled} onChange={(e) => setFillEnabled(e.target.checked)} disabled={disabled} className="h-4 w-4 rounded border-[color:var(--border)] text-[color:var(--brand-green)]" />
                On
              </label>
            </div>
          </div>
        </div>

        <div className={`${sectionClass} min-w-0 flex-col items-stretch justify-between`}>
          {utilityButtons}
          {!compact && (
            <div className="rounded-[1.25rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-2.5 text-xs leading-5 text-[color:var(--text-muted)]">
              Froddle keeps the toolbar roomy on smaller screens so controls stay legible and separated from the canvas area.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
