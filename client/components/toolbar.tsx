import type { DrawingTool } from '@cloudcanvas/shared';
import { Button, SecondaryButton } from './ui';

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
}

const PenIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="m3 21 3-.5L19.5 7a2.1 2.1 0 0 0-3-3L3 17.5 3 21Z" />
  </svg>
);

const EraserIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="m7 19 9.5-9.5a2.2 2.2 0 0 0 0-3.1l-1.9-1.9a2.2 2.2 0 0 0-3.1 0L2 14l5 5Z" />
    <path d="M22 19H7" />
  </svg>
);

const toolButtonClass = (active: boolean) =>
  active
    ? 'border-slate-900 bg-slate-900 text-white shadow-sm hover:bg-slate-800'
    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50';

export function Toolbar({ tool, setTool, color, setColor, size, setSize, onClear, onUndo, onDownload }: ToolbarProps) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <Button className={`gap-2 border ${toolButtonClass(tool === 'pen')}`} onClick={() => setTool('pen')}>
          <PenIcon /> Pen
        </Button>
        <Button className={`gap-2 border ${toolButtonClass(tool === 'eraser')}`} onClick={() => setTool('eraser')}>
          <EraserIcon /> Eraser
        </Button>
        <div className="mx-1 hidden h-7 w-px bg-slate-200 sm:block" />
        <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-2.5 py-1.5 text-xs font-medium text-slate-600">
          Color
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-7 w-7 cursor-pointer rounded border border-slate-300 bg-white" />
        </label>
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-2.5 py-2 text-xs font-medium text-slate-600">
          Size
          <input type="range" min={1} max={24} value={size} onChange={(e) => setSize(Number(e.target.value))} />
          <span className="w-6 text-right text-xs text-slate-500">{size}</span>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SecondaryButton onClick={onUndo}>Undo</SecondaryButton>
        <SecondaryButton onClick={onClear}>Clear</SecondaryButton>
        <Button onClick={onDownload}>Download</Button>
      </div>
    </div>
  );
}
