export type DrawingTool = 'pen' | 'eraser';

export interface CanvasPoint {
  x: number;
  y: number;
}

export interface Stroke {
  strokeId: string;
  roomId: string;
  userId: string;
  tool: DrawingTool;
  color: string;
  size: number;
  points: CanvasPoint[];
  timestamp: number;
}
