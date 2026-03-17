import type { BrushStyle, DrawingTool, RoomMode } from "@cloudcanvas/shared";
import { Button, SecondaryButton } from "./ui";

interface ToolbarProps {
  tool: DrawingTool;
  setTool: (tool: DrawingTool) => void;
  brushStyle: BrushStyle;
  setBrushStyle: (style: BrushStyle) => void;
  mode: RoomMode;
  onToggleMode: () => void;
  stickerMode: string | null;
  setStickerMode: (sticker: string | null) => void;
  color: string;
  setColor: (color: string) => void;
  size: number;
  setSize: (size: number) => void;
  onClear: () => void;
  onUndo: () => void;
  onDownload: () => void;
  onCopyImage: () => void;
  disabled?: boolean;
}

const PRESET_COLORS = ["#2f2144", "#ff5fa2", "#ff8a65", "#ffc857", "#45d9a8", "#57c7ff", "#6d5efc"];
const STICKERS = ["😈", "🎨", "✨", "🦄", "🍭", "🔥"];
const BRUSHES: BrushStyle[] = ["classic", "rainbow", "neon", "dotted", "spray"];

export function Toolbar({ tool, setTool, brushStyle, setBrushStyle, mode, onToggleMode, stickerMode, setStickerMode, color, setColor, size, setSize, onClear, onUndo, onDownload, onCopyImage, disabled = false }: ToolbarProps) {
  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-fuchsia-100 bg-white/95 p-4 shadow-sm">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setTool("pen")} disabled={disabled}>🖌️ Brush</Button>
        <Button onClick={() => setTool("eraser")} disabled={disabled}>🧽 Eraser</Button>
        <SecondaryButton onClick={onToggleMode} disabled={disabled}>{mode === "free-draw" ? "🎮 Enable Guess Mode" : "🧘 Free Draw Mode"}</SecondaryButton>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {BRUSHES.map((b) => (
          <button key={b} type="button" className={`rounded-full border px-3 py-1 ${brushStyle === b ? "bg-purple-600 text-white" : "bg-white text-purple-700"}`} onClick={() => setBrushStyle(b)} disabled={disabled || tool === "eraser"}>{b}</button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} disabled={disabled || tool === "eraser"} className="h-10 w-10" />
        {PRESET_COLORS.map((preset) => (
          <button key={preset} type="button" onClick={() => setColor(preset)} className="h-7 w-7 rounded-full" style={{ backgroundColor: preset }} />
        ))}
        <input type="range" min={1} max={24} value={size} onChange={(e) => setSize(Number(e.target.value))} disabled={disabled} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SecondaryButton onClick={() => setStickerMode(stickerMode ? null : STICKERS[0])} disabled={disabled}>{stickerMode ? "❌ Sticker Off" : "🌟 Sticker Mode"}</SecondaryButton>
        {stickerMode && STICKERS.map((item) => (
          <button key={item} className={`rounded-xl border px-2 py-1 text-lg ${stickerMode === item ? "bg-pink-100" : "bg-white"}`} onClick={() => setStickerMode(item)}>{item}</button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SecondaryButton onClick={onUndo} disabled={disabled}>↶ Undo</SecondaryButton>
        <SecondaryButton onClick={onClear} disabled={disabled}>🗑️ Clear</SecondaryButton>
        <Button onClick={onDownload} disabled={disabled}>⬇️ Export</Button>
        <SecondaryButton onClick={onCopyImage} disabled={disabled}>📋 Copy image</SecondaryButton>
      </div>
    </div>
  );
}
