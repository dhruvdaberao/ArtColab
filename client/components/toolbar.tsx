import type { BrushStyle, DrawingTool, ShapeKind } from "@cloudcanvas/shared";
import {
  Circle,
  Download,
  Eraser,
  PaintBucket,
  Pencil,
  Redo2,
  Shapes,
  Slash,
  Square,
  Star,
  Triangle,
  Undo2,
  X,
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
  onUndo: () => void;
  onRedo: () => void;
  onDownload: () => void;
  canUndo: boolean;
  canRedo: boolean;
  disabled?: boolean;
  mobile?: boolean;
}

const PRESET_COLORS = [
  "#111111",
  "#ffffff",
  "#ffd84d",
  "#ff8a5b",
  "#ff5d8f",
  "#8b5cf6",
  "#1c7dd7",
  "#18c964",
];

const BRUSHES: Array<{ id: BrushStyle; label: string }> = [
  { id: "classic", label: "Classic" },
  { id: "crayon", label: "Crayon" },
  { id: "neon", label: "Neon" },
  { id: "spray", label: "Spray" },
  { id: "dotted", label: "Dotted" },
];

const SHAPES: Array<{ tool: ShapeKind; label: string; icon: typeof Slash }> = [
  { tool: "line", label: "Line", icon: Slash },
  { tool: "rectangle", label: "Rectangle", icon: Square },
  { tool: "square", label: "Square", icon: Square },
  { tool: "circle", label: "Circle", icon: Circle },
  { tool: "ellipse", label: "Ellipse", icon: Circle },
  { tool: "triangle", label: "Triangle", icon: Triangle },
  { tool: "star", label: "Star", icon: Star },
];

const primaryTools = [
  { id: "pen", label: "Brush", icon: Pencil },
  { id: "eraser", label: "Eraser", icon: Eraser },
  { id: "fill", label: "Fill", icon: PaintBucket },
] as const;

const panelShell =
  "rounded-[1.6rem] border border-[color:var(--border)]/15 bg-[color:var(--surface)]/96 p-4 shadow-[0_20px_50px_rgba(15,23,42,0.14)] backdrop-blur";
const iconButtonBase =
  "inline-flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-[1.15rem] border px-3 py-2 text-sm font-semibold leading-none transition disabled:cursor-not-allowed disabled:opacity-45";

function toolMeta(tool: DrawingTool) {
  if (tool === "pen")
    return {
      title: "Brush",
      description: "Draw with textured brushes and quick color changes.",
    };
  if (tool === "eraser")
    return {
      title: "Eraser",
      description: "Erase details cleanly with a simple size control.",
    };
  if (tool === "fill")
    return {
      title: "Fill",
      description:
        "Tap enclosed regions to flood them with the selected color.",
    };
  const shape = SHAPES.find((item) => item.tool === tool);
  return {
    title: shape ? `${shape.label} shape` : "Shape",
    description: "Draw clean shapes with optional fill color.",
  };
}

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
  onUndo,
  onRedo,
  onDownload,
  canUndo,
  canRedo,
  disabled = false,
  mobile = false,
}: ToolbarProps) {
  const [activePanel, setActivePanel] = useState<
    "brush" | "eraser" | "shape" | "fill" | null
  >("brush");
  const customColorInputRef = useRef<HTMLInputElement | null>(null);
  const isShapeTool = SHAPES.some((shape) => shape.tool === tool);
  const currentPanel = useMemo(() => {
    if (tool === "pen") return "brush" as const;
    if (tool === "eraser") return "eraser" as const;
    if (tool === "fill") return "fill" as const;
    if (isShapeTool) return "shape" as const;
    return activePanel;
  }, [activePanel, isShapeTool, tool]);

  useEffect(() => {
    if (tool === "pen") setActivePanel("brush");
    else if (tool === "eraser") setActivePanel("eraser");
    else if (tool === "fill") setActivePanel("fill");
    else if (isShapeTool) setActivePanel("shape");
  }, [isShapeTool, tool]);

  const selectedColor = tool === "fill" ? fillColor : strokeColor;
  const selectedMeta = toolMeta(tool);

  const applyActiveColor = (value: string) => {
    if (tool === "fill") {
      setFillColor(value);
      setFillEnabled(true);
      return;
    }
    if (isShapeTool) {
      setStrokeColor(value);
      return;
    }
    if (tool !== "eraser") setStrokeColor(value);
  };

  const showColorControls = tool !== "eraser";

  const openPanelForTool = (
    nextTool: (typeof primaryTools)[number]["id"] | "shape",
  ) => {
    if (nextTool === "shape") {
      setActivePanel("shape");
      if (!isShapeTool) setTool("line");
      return;
    }
    if (nextTool === "fill") setFillEnabled(true);
    setTool(nextTool);
    setActivePanel(nextTool === "pen" ? "brush" : nextTool);
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 sm:top-[5.5rem] sm:bottom-auto sm:right-4 sm:left-auto sm:w-[22rem] sm:justify-end sm:px-0 sm:pb-0">
      <div className="pointer-events-auto flex w-full max-w-5xl flex-col gap-3 sm:w-[22rem] sm:max-w-none">
        <div className="flex items-center justify-between gap-3 rounded-[1.75rem] border border-[color:var(--border)]/15 bg-[color:var(--surface)]/92 px-3 py-3 shadow-[0_18px_50px_rgba(15,23,42,0.18)] backdrop-blur sm:hidden">
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-[color:var(--text-main)]">
              {selectedMeta.title}
            </p>
            <p className="truncate text-xs text-[color:var(--text-muted)]">
              {selectedMeta.description}
            </p>
          </div>
          <button
            type="button"
            className={`${iconButtonBase} border-[color:var(--border)]/15 bg-[color:var(--bg-elevated)] text-[color:var(--text-main)]`}
            onClick={() =>
              setActivePanel((value) =>
                value ? null : (currentPanel ?? "brush"),
              )
            }
          >
            {activePanel ? <X size={18} /> : <Shapes size={18} />}
            <span className="text-xs font-black">
              {activePanel ? "Hide" : "Tools"}
            </span>
          </button>
        </div>

        {(activePanel || !mobile) && (
          <div
            className={`${panelShell} ${mobile ? "rounded-[1.75rem]" : "rounded-[2rem]"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[color:var(--text-muted)]">
                  Tool panel
                </p>
                <h2 className="mt-1 text-lg font-black text-[color:var(--text-main)]">
                  {selectedMeta.title}
                </h2>
                <p className="mt-1 text-sm leading-5 text-[color:var(--text-muted)]">
                  {selectedMeta.description}
                </p>
              </div>
              <div className="hidden items-center gap-2 sm:flex">
                <button
                  type="button"
                  className={`${iconButtonBase} border-[color:var(--border)]/15 bg-[color:var(--bg-elevated)] text-[color:var(--text-main)]`}
                  onClick={onUndo}
                  disabled={disabled || !canUndo}
                  aria-label="Undo"
                  title="Undo"
                >
                  <Undo2 size={18} />
                </button>
                <button
                  type="button"
                  className={`${iconButtonBase} border-[color:var(--border)]/15 bg-[color:var(--bg-elevated)] text-[color:var(--text-main)]`}
                  onClick={onRedo}
                  disabled={disabled || !canRedo}
                  aria-label="Redo"
                  title="Redo"
                >
                  <Redo2 size={18} />
                </button>
                <button
                  type="button"
                  className={`${iconButtonBase} border-[color:var(--border)]/15 bg-[color:var(--bg-elevated)] text-[color:var(--text-main)]`}
                  onClick={onDownload}
                  disabled={disabled}
                  aria-label="Export drawing"
                  title="Export drawing"
                >
                  <Download size={18} />
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-5 gap-2 rounded-[1.5rem] bg-[color:var(--bg-elevated)]/95 p-2">
              {primaryTools.map(({ id, label, icon: Icon }) => {
                const selected = tool === id;
                return (
                  <button
                    key={id}
                    type="button"
                    className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-[1.2rem] border px-2 py-2 text-[11px] font-black transition ${selected ? "border-transparent bg-[color:var(--brand-blue)] text-white shadow-[0_12px_24px_rgba(28,125,215,0.28)]" : "border-[color:var(--border)]/10 bg-[color:var(--surface)] text-[color:var(--text-main)] hover:bg-[color:var(--surface-soft)]"}`}
                    onClick={() => openPanelForTool(id)}
                    disabled={disabled}
                    aria-pressed={selected}
                  >
                    <Icon size={18} />
                    <span>{label}</span>
                  </button>
                );
              })}
              <button
                type="button"
                className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-[1.2rem] border px-2 py-2 text-[11px] font-black transition ${isShapeTool ? "border-transparent bg-[color:var(--brand-blue)] text-white shadow-[0_12px_24px_rgba(28,125,215,0.28)]" : "border-[color:var(--border)]/10 bg-[color:var(--surface)] text-[color:var(--text-main)] hover:bg-[color:var(--surface-soft)]"}`}
                onClick={() => openPanelForTool("shape")}
                disabled={disabled}
                aria-pressed={isShapeTool}
              >
                <Shapes size={18} />
                <span>Shape</span>
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {(currentPanel === "brush" ||
                currentPanel === "eraser" ||
                currentPanel === "shape") && (
                <section className="rounded-[1.35rem] bg-[color:var(--bg-elevated)]/95 p-3.5">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
                      {tool === "eraser"
                        ? "Eraser size"
                        : isShapeTool
                          ? "Stroke size"
                          : "Brush size"}
                    </p>
                    <span className="rounded-full bg-[color:var(--surface)] px-2.5 py-1 text-sm font-black text-[color:var(--text-main)]">
                      {size}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={24}
                    value={size}
                    onChange={(event) => setSize(Number(event.target.value))}
                    disabled={disabled}
                    className="h-2 w-full cursor-pointer accent-[color:var(--brand-blue)]"
                  />
                </section>
              )}

              {currentPanel === "brush" && (
                <section className="rounded-[1.35rem] bg-[color:var(--bg-elevated)]/95 p-3.5">
                  <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
                    Brush type
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {BRUSHES.map((brush) => (
                      <button
                        key={brush.id}
                        type="button"
                        className={`min-h-11 rounded-[1rem] border px-3 py-2 text-sm font-semibold transition ${brushStyle === brush.id ? "border-transparent bg-[color:var(--brand-blue)] text-white shadow-[0_10px_24px_rgba(28,125,215,0.24)]" : "border-[color:var(--border)]/10 bg-[color:var(--surface)] text-[color:var(--text-main)] hover:bg-[color:var(--surface-soft)]"}`}
                        onClick={() => setBrushStyle(brush.id)}
                        disabled={disabled}
                      >
                        {brush.label}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {currentPanel === "shape" && (
                <section className="space-y-3 rounded-[1.35rem] bg-[color:var(--bg-elevated)]/95 p-3.5">
                  <div>
                    <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
                      Shape type
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {SHAPES.map(({ tool: shapeTool, label, icon: Icon }) => (
                        <button
                          key={shapeTool}
                          type="button"
                          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-[1rem] border px-3 py-2 text-sm font-semibold transition ${tool === shapeTool ? "border-transparent bg-[color:var(--brand-blue)] text-white shadow-[0_10px_24px_rgba(28,125,215,0.24)]" : "border-[color:var(--border)]/10 bg-[color:var(--surface)] text-[color:var(--text-main)] hover:bg-[color:var(--surface-soft)]"}`}
                          onClick={() => setTool(shapeTool)}
                          disabled={disabled}
                        >
                          <Icon size={16} />
                          <span>{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-[1rem] bg-[color:var(--surface)] px-3 py-3">
                    <div>
                      <p className="text-sm font-black text-[color:var(--text-main)]">
                        Shape fill
                      </p>
                      <p className="text-xs text-[color:var(--text-muted)]">
                        Use the selected fill color inside closed shapes.
                      </p>
                    </div>
                    <button
                      type="button"
                      className={`inline-flex min-h-11 min-w-[4.75rem] items-center justify-center rounded-full px-4 text-sm font-black transition ${fillEnabled ? "bg-[color:var(--brand-green)] text-white" : "bg-[color:var(--surface-soft)] text-[color:var(--text-main)]"}`}
                      onClick={() => setFillEnabled(!fillEnabled)}
                      disabled={disabled}
                    >
                      {fillEnabled ? "On" : "Off"}
                    </button>
                  </div>
                </section>
              )}

              {currentPanel === "fill" && (
                <section className="rounded-[1.35rem] bg-[color:var(--bg-elevated)]/95 p-3.5 text-sm text-[color:var(--text-muted)]">
                  <p className="font-semibold text-[color:var(--text-main)]">
                    Fill with selected color
                  </p>
                  <p className="mt-1 leading-5">
                    Tap or click an enclosed area on the canvas to fill it. The
                    current swatch below is the active fill color.
                  </p>
                </section>
              )}

              {showColorControls && (
                <section className="space-y-3 rounded-[1.35rem] bg-[color:var(--bg-elevated)]/95 p-3.5">
                  <div className="flex items-center justify-between gap-3 rounded-[1rem] bg-[color:var(--surface)] px-3 py-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
                        Selected color
                      </p>
                      <p className="mt-1 text-sm font-black text-[color:var(--text-main)]">
                        {selectedColor.toUpperCase()}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="h-12 w-12 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(26,26,26,0.12)]"
                      style={{ backgroundColor: selectedColor }}
                      onClick={() => customColorInputRef.current?.click()}
                      aria-label="Choose custom color"
                    />
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
                      Presets
                    </p>
                    <div className="grid grid-cols-8 gap-2">
                      {PRESET_COLORS.map((preset) => {
                        const selected =
                          preset.toLowerCase() === selectedColor.toLowerCase();
                        return (
                          <button
                            key={preset}
                            type="button"
                            className={`h-10 w-full rounded-full border-2 transition ${selected ? "border-[color:var(--brand-blue)] ring-2 ring-[color:var(--brand-blue)]/20" : "border-white/80"}`}
                            style={{ backgroundColor: preset }}
                            onClick={() => applyActiveColor(preset)}
                            disabled={disabled}
                            aria-label={`Use color ${preset}`}
                          />
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {recentColors.slice(0, 6).map((color) => (
                      <button
                        key={`recent-${color}`}
                        type="button"
                        className="inline-flex items-center gap-2 rounded-full bg-[color:var(--surface)] px-3 py-2 text-xs font-semibold text-[color:var(--text-main)]"
                        onClick={() => applyActiveColor(color)}
                      >
                        <span
                          className="h-4 w-4 rounded-full border border-[color:var(--border)]/15"
                          style={{ backgroundColor: color }}
                        />
                        {color.toUpperCase()}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center justify-center rounded-[1rem] bg-[color:var(--surface)] px-4 py-2 text-sm font-black text-[color:var(--text-main)] shadow-[0_8px_20px_rgba(15,23,42,0.08)]"
                    onClick={() => customColorInputRef.current?.click()}
                    disabled={disabled}
                  >
                    Open custom color picker
                  </button>
                  <input
                    ref={customColorInputRef}
                    type="color"
                    className="sr-only"
                    value={selectedColor}
                    onChange={(event) => applyActiveColor(event.target.value)}
                    disabled={disabled}
                  />
                </section>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
