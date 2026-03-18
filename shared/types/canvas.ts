export type ShapeKind = "line" | "rectangle" | "square" | "circle" | "ellipse" | "triangle" | "star";
export type DrawingTool = "pen" | "eraser" | ShapeKind;
export type BrushStyle = "classic" | "rainbow" | "neon" | "dotted" | "spray";

export interface CanvasPoint {
  x: number;
  y: number;
}

export interface ShapeOptions {
  kind: ShapeKind;
  start: CanvasPoint;
  end: CanvasPoint;
  fillColor?: string | null;
}

export interface Stroke {
  strokeId: string;
  roomId: string;
  userId: string;
  tool: DrawingTool;
  brushStyle?: BrushStyle;
  color: string;
  fillColor?: string | null;
  size: number;
  points: CanvasPoint[];
  shape?: ShapeOptions;
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
