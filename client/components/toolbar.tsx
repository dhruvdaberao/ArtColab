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

const PRESET_COLORS = ["#2f2144", "#ff5fa2", "#ff8a65", "#ffc857", "#45d9a8", "#57c7ff", "#6d5efc", "#b67cff", "#ff6c87", "#111827"];

const toolButtonClass = (active: boolean) =>
  active
    ? "border-pink-200 bg-gradient-to-r from-pink-500 to-violet-500 text-white shadow-md hover:from-pink-400 hover:to-violet-400"
    : "border-fuchsia-100 bg-white text-purple-700 hover:bg-fuchsia-50";

export function Toolbar({ tool, setTool, color, setColor, size, setSize, onClear, onUndo, onDownload, disabled = false }: ToolbarProps) {
  const brushPreviewSize = Math.max(6, Math.min(size, 24));

  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-fuchsia-100 bg-white/95 p-4 shadow-sm transition-all lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button className={`min-h-11 border ${toolButtonClass(tool === "pen")} ${tool === 'pen' ? 'animate-[wiggle-float_1.8s_ease-in-out_infinite]' : ''}`} onClick={() => setTool("pen")} disabled={disabled} aria-pressed={tool === "pen"}>🖌️ Brush (B)</Button>
          <Button className={`min-h-11 border ${toolButtonClass(tool === "eraser")}`} onClick={() => setTool("eraser")} disabled={disabled} aria-pressed={tool === "eraser"}>🧽 Eraser (E)</Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <label className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-pink-100 bg-pink-50 px-2.5 py-1.5 text-xs font-semibold text-purple-700">
            <span>🎨</span>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} disabled={disabled || tool === "eraser"} className="h-8 w-8 cursor-pointer rounded-xl border border-pink-100 bg-white disabled:cursor-not-allowed" aria-label="Pick drawing color" />
          </label>

          <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-fuchsia-100 bg-violet-50/80 px-2 py-1.5" aria-label="Preset color palette">
            {PRESET_COLORS.map((preset) => {
              const selected = color.toLowerCase() === preset.toLowerCase();
              return (
                <button key={preset} type="button" onClick={() => setColor(preset)} disabled={disabled || tool === "eraser"} aria-label={`Select color ${preset}`} aria-pressed={selected} className={`h-7 w-7 rounded-full border transition-transform hover:scale-110 ${selected ? "scale-110 border-white ring-2 ring-pink-400" : "border-white/80"} disabled:cursor-not-allowed disabled:opacity-50`} style={{ backgroundColor: preset }} />
              );
            })}
          </div>

          <label className="flex min-h-11 items-center gap-2 rounded-2xl border border-fuchsia-100 bg-sky-50 px-2.5 py-2 text-xs font-semibold text-purple-700">
            <span>Size</span>
            <input type="range" min={1} max={24} value={size} onChange={(e) => setSize(Number(e.target.value))} disabled={disabled} className="w-24 accent-pink-500 sm:w-32" />
            <span className="w-6 text-right text-xs text-purple-600">{size}</span>
            <span className="inline-block rounded-full border border-fuchsia-200 transition-all" style={{ width: brushPreviewSize, height: brushPreviewSize, backgroundColor: tool === "eraser" ? "#fff" : color }} aria-hidden />
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SecondaryButton onClick={onUndo} disabled={disabled} className="min-h-11">↶ Undo</SecondaryButton>
        <SecondaryButton onClick={onClear} disabled={disabled} className="min-h-11">🗑️ Clear</SecondaryButton>
        <Button onClick={onDownload} disabled={disabled} className="min-h-11">⬇️ Download</Button>
      </div>
    </div>
  );
}
