import { Button } from './ui';
import type { DrawingTool } from '@cloudcanvas/shared';

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

export function Toolbar({ tool, setTool, color, setColor, size, setSize, onClear, onUndo, onDownload }: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <Button className={tool === 'pen' ? '' : 'bg-slate-600'} onClick={() => setTool('pen')}>
        Pen
      </Button>
      <Button className={tool === 'eraser' ? '' : 'bg-slate-600'} onClick={() => setTool('eraser')}>
        Eraser
      </Button>
      <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-12 rounded border border-slate-300" />
      <label className="flex items-center gap-2 text-sm text-slate-700">
        Size
        <input type="range" min={1} max={24} value={size} onChange={(e) => setSize(Number(e.target.value))} />
      </label>
      <Button onClick={onUndo}>Undo</Button>
      <Button onClick={onClear}>Clear</Button>
      <Button onClick={onDownload}>Download</Button>
    </div>
  );
}
