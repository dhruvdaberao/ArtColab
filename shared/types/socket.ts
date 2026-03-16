import type { CanvasPoint, Stroke } from './canvas';
import type { Participant, RoomState } from './room';

export const SOCKET_EVENTS = {
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  ROOM_STATE_REQUEST: 'room:state:request',
  ROOM_JOINED: 'room:joined',
  ROOM_EXPIRED: 'room:expired',
  ROOM_ERROR: 'room:error',
  ROOM_STATE: 'room:state',
  ROOM_PARTICIPANTS_UPDATED: 'room:participants:updated',
  ROOM_PARTICIPANT_JOINED: 'room:participant:joined',
  ROOM_PARTICIPANT_LEFT: 'room:participant:left',
  STROKE_START: 'stroke:start',
  STROKE_APPEND: 'stroke:append',
  STROKE_END: 'stroke:end',
  STROKE_EVENT: 'stroke:event',
  BOARD_CLEAR: 'board:clear',
  BOARD_CLEARED: 'board:cleared',
  STROKE_UNDO: 'stroke:undo',
  STROKE_UNDONE: 'stroke:undone'
} as const;

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
