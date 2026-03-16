import type { Stroke } from './canvas';

export interface Participant {
  socketId: string;
  userId: string;
  displayName: string;
  joinedAt: number;
}

export interface RoomState {
  roomId: string;
  createdAt: number;
  updatedAt: number;
  expiresAt: number | null;
  participants: Participant[];
  strokes: Stroke[];
}
