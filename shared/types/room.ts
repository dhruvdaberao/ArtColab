import type { Sticker, Stroke } from "./canvas.js";
import type { RoomMode } from "./socket.js";

export interface Participant {
  socketId: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  joinedAt: number;
}

export interface ChatMessage {
  messageId: string;
  roomId: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  text: string;
  timestamp: number;
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
  stickers: Sticker[];
  chatMessages: ChatMessage[];
  mode: RoomMode;
}
