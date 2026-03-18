import type { CanvasPoint, Sticker, Stroke } from "./canvas.js";
import type { Participant, RoomState } from "./room.js";

export const SOCKET_EVENTS = {
  ROOM_JOIN: "room:join",
  ROOM_LEAVE: "room:leave",
  ROOM_STATE_REQUEST: "room:state:request",
  ROOM_JOINED: "room:joined",
  ROOM_EXPIRED: "room:expired",
  ROOM_ERROR: "room:error",
  ROOM_STATE: "room:state",
  ROOM_PARTICIPANTS_UPDATED: "room:participants:updated",
  ROOM_PARTICIPANT_JOINED: "room:participant:joined",
  ROOM_PARTICIPANT_LEFT: "room:participant:left",
  STROKE_START: "stroke:start",
  STROKE_APPEND: "stroke:append",
  STROKE_END: "stroke:end",
  STROKE_EVENT: "stroke:event",
  BOARD_CLEAR: "board:clear",
  BOARD_CLEARED: "board:cleared",
  STROKE_UNDO: "stroke:undo",
  STROKE_UNDONE: "stroke:undone",
  STROKE_REDO: "stroke:redo",
  STROKE_REDONE: "stroke:redone",
  CURSOR_UPDATE: "cursor:update",
  CURSOR_PRESENCE: "cursor:presence",
  CHAT_SEND: "chat:send",
  CHAT_MESSAGE: "chat:message",
  REACTION_SEND: "reaction:send",
  REACTION_EVENT: "reaction:event",
  STICKER_PLACE: "sticker:place",
  STICKER_PLACED: "sticker:placed",
  MODE_SET: "mode:set",
  MODE_UPDATED: "mode:updated",
} as const;

export type RoomMode = "free-draw" | "guess-mode";

export interface JoinRoomPayload {
  roomId: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
}

export interface CursorPayload {
  roomId: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  x: number;
  y: number;
  drawing: boolean;
  updatedAt: number;
}

export interface DrawStartPayload {
  roomId: string;
  stroke: Omit<Stroke, "points" | "timestamp"> & { points: CanvasPoint[] };
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

export interface RedoStrokePayload {
  roomId: string;
  userId: string;
}

export interface RoomJoinedPayload {
  room: RoomState;
  participant: Participant;
}

export interface ChatMessagePayload {
  roomId: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  text: string;
}

export interface ReactionPayload {
  roomId: string;
  userId: string;
  displayName: string;
  emoji: "❤️" | "😂" | "😮" | "🔥" | "🎉";
  x?: number;
  y?: number;
}

export interface StickerPayload {
  roomId: string;
  sticker: Sticker;
}

export interface ModePayload {
  roomId: string;
  mode: RoomMode;
}

export interface ErrorPayload {
  code: string;
  message: string;
}
