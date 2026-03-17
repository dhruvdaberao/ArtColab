export type DrawingTool = "pen" | "eraser";
export type BrushStyle = "classic" | "rainbow" | "neon" | "dotted" | "spray";

export interface CanvasPoint {
  x: number;
  y: number;
}

export interface Stroke {
  strokeId: string;
  roomId: string;
  userId: string;
  tool: DrawingTool;
  brushStyle?: BrushStyle;
  color: string;
  size: number;
  points: CanvasPoint[];
  timestamp: number;
}

export interface Sticker {
  stickerId: string;
  roomId: string;
  userId: string;
  value: string;
  x: number;
  y: number;
  size: number;
  timestamp: number;
}
