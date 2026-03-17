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

const PenIcon = () => <span>🖌️</span>;
const EraserIcon = () => <span>🧽</span>;
const UndoIcon = () => <span>↶</span>;
const ClearIcon = () => <span>🗑️</span>;
const DownloadIcon = () => <span>⬇️</span>;

const toolButtonClass = (active: boolean) =>
  active
    ? "border-indigo-600 bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-500/30 hover:bg-indigo-500"
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
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition-all lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            className={`min-h-11 gap-2 border ${toolButtonClass(tool === "pen")}`}
            onClick={() => setTool("pen")}
            disabled={disabled}
            aria-pressed={tool === "pen"}
          >
            <PenIcon /> Brush (B)
          </Button>
          <Button
            className={`min-h-11 gap-2 border ${toolButtonClass(tool === "eraser")}`}
            onClick={() => setTool("eraser")}
            disabled={disabled}
            aria-pressed={tool === "eraser"}
          >
            <EraserIcon /> Eraser (E)
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <label className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-2.5 py-1.5 text-xs font-medium text-slate-600">
            <span>🎨</span>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              disabled={disabled || tool === "eraser"}
              className="h-8 w-8 cursor-pointer rounded border border-slate-300 bg-white disabled:cursor-not-allowed"
              aria-label="Pick drawing color"
            />
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
                  className={`h-7 w-7 rounded-full border transition-transform ${selected ? "scale-110 border-slate-900 ring-2 ring-slate-900/20" : "border-slate-300"} disabled:cursor-not-allowed disabled:opacity-50`}
                  style={{ backgroundColor: preset }}
                />
              );
            })}
          </div>

          <label className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-2.5 py-2 text-xs font-medium text-slate-600">
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
              className="inline-block rounded-full border border-slate-300 transition-all"
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
        <SecondaryButton
          onClick={onUndo}
          disabled={disabled}
          className="min-h-11 gap-2"
        >
          <UndoIcon /> Undo
        </SecondaryButton>
        <SecondaryButton
          onClick={onClear}
          disabled={disabled}
          className="min-h-11 gap-2"
        >
          <ClearIcon /> Clear
        </SecondaryButton>
        <Button
          onClick={onDownload}
          disabled={disabled}
          className="min-h-11 gap-2"
        >
          <DownloadIcon /> Download
        </Button>
      </div>
    </div>
  );
}
