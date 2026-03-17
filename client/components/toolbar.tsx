import type { DrawingTool } from "@cloudcanvas/shared";
import { Button, SecondaryButton } from "./ui";

interface ToolbarProps {
  tool: DrawingTool;
  setTool: (tool: DrawingTool) => void;
  color: string;
  setColor: (color: string) => void;
  size: number;
  setSize: (size: number) => void;
  onClear: () => void;
  onUndo: () => void;
  onDownload: () => void;
  disabled?: boolean;
}

const PRESET_COLORS = [
  "#0f172a",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#a855f7",
  "#ec4899",
  "#111827",
];

const PenIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
  >
    <path d="m3 21 3-.5L19.5 7a2.1 2.1 0 0 0-3-3L3 17.5 3 21Z" />
  </svg>
);

const EraserIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
  >
    <path d="m7 19 9.5-9.5a2.2 2.2 0 0 0 0-3.1l-1.9-1.9a2.2 2.2 0 0 0-3.1 0L2 14l5 5Z" />
    <path d="M22 19H7" />
  </svg>
);

const toolButtonClass = (active: boolean) =>
  active
    ? "border-slate-900 bg-slate-900 text-white shadow-sm ring-2 ring-slate-900/10 hover:bg-slate-800"
    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50";

export function Toolbar({
  tool,
  setTool,
  color,
  setColor,
  size,
  setSize,
  onClear,
  onUndo,
  onDownload,
  disabled = false,
}: ToolbarProps) {
  const brushPreviewSize = Math.max(6, Math.min(size, 24));

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-sm transition-all lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            className={`gap-2 border ${toolButtonClass(tool === "pen")}`}
            onClick={() => setTool("pen")}
            disabled={disabled}
            aria-pressed={tool === "pen"}
          >
            <PenIcon /> Pen (B)
          </Button>
          <Button
            className={`gap-2 border ${toolButtonClass(tool === "eraser")}`}
            onClick={() => setTool("eraser")}
            disabled={disabled}
            aria-pressed={tool === "eraser"}
          >
            <EraserIcon /> Eraser (E)
          </Button>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
            Active tool:{" "}
            <span className="font-semibold text-slate-900">
              {tool === "pen" ? "Pen" : "Eraser"}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-2.5 py-1.5 text-xs font-medium text-slate-600">
            <span>Color</span>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              disabled={disabled || tool === "eraser"}
              className="h-8 w-8 cursor-pointer rounded border border-slate-300 bg-white disabled:cursor-not-allowed"
              aria-label="Pick drawing color"
            />
            <span className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] uppercase text-slate-500">
              {color}
            </span>
          </label>

          <div
            className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/70 px-2 py-1.5"
            aria-label="Preset color palette"
          >
            {PRESET_COLORS.map((preset) => {
              const selected = color.toLowerCase() === preset.toLowerCase();
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setColor(preset)}
                  disabled={disabled || tool === "eraser"}
                  aria-label={`Select color ${preset}`}
                  aria-pressed={selected}
                  className={`h-6 w-6 rounded-full border transition-transform ${selected ? "scale-110 border-slate-900 ring-2 ring-slate-900/20" : "border-slate-300"} disabled:cursor-not-allowed disabled:opacity-50`}
                  style={{ backgroundColor: preset }}
                />
              );
            })}
          </div>

          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-2.5 py-2 text-xs font-medium text-slate-600">
            <span>Size</span>
            <input
              type="range"
              min={1}
              max={24}
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              disabled={disabled}
              className="w-24 sm:w-32"
            />
            <span className="w-6 text-right text-xs text-slate-500">
              {size}
            </span>
            <span
              className="inline-block rounded-full border border-slate-300 bg-slate-800 transition-all"
              style={{
                width: brushPreviewSize,
                height: brushPreviewSize,
                backgroundColor: tool === "eraser" ? "#fff" : color,
              }}
              aria-hidden
            />
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SecondaryButton onClick={onUndo} disabled={disabled}>
          Undo (⌘/Ctrl+Z)
        </SecondaryButton>
        <SecondaryButton onClick={onClear} disabled={disabled}>
          Clear
        </SecondaryButton>
        <Button onClick={onDownload} disabled={disabled}>
          Download
        </Button>
      </div>
    </div>
  );
}
