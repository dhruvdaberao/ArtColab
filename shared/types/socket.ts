import type { CanvasPoint, Stroke } from './canvas';
import type { Participant, RoomState } from './room';

export interface JoinRoomPayload {
  roomId: string;
  userId: string;
  displayName: string;
}

export interface DrawStartPayload {
  roomId: string;
  stroke: Omit<Stroke, 'points' | 'timestamp'> & { points: CanvasPoint[] };
}

export interface DrawMovePayload {
  roomId: string;
  strokeId: string;
  points: CanvasPoint[];
}

export interface DrawEndPayload {
  roomId: string;
  strokeId: string;
}

export interface ClearBoardPayload {
  roomId: string;
}

export interface UndoStrokePayload {
  roomId: string;
  userId: string;
}

export interface RoomJoinedPayload {
  room: RoomState;
  participant: Participant;
}

export interface ErrorPayload {
  code: string;
  message: string;
}
