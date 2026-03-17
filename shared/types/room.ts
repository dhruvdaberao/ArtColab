import type { Stroke } from "./canvas.js";

export interface Participant {
  socketId: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  joinedAt: number;
}

export interface RoomState {
  roomId: string;
  name?: string;
  visibility?: "public" | "private";
  createdAt: number;
  updatedAt: number;
  lastActiveAt?: number;
  expiresAt: number | null;
  participants: Participant[];
  strokes: Stroke[];
}
