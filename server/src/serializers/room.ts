import type { Sticker, Stroke } from '@cloudcanvas/shared';

export type RoomVisibility = 'public' | 'private';
export type RoomOwnerType = 'user' | 'guest';

export type RoomHydrationSource = {
  roomId: string;
  name: string;
  visibility: RoomVisibility;
  passwordHash?: string | null;
  ownerType: RoomOwnerType;
  ownerId: string;
  ownerName: string;
  createdAt: Date;
  updatedAt: Date;
  lastActiveAt: Date;
  canvasState?: {
    strokes?: Stroke[];
    stickers?: Sticker[];
  } | null;
};

export const toHydratedRoom = (room: RoomHydrationSource) => ({
  roomId: room.roomId,
  name: room.name,
  visibility: room.visibility,
  passwordHash: room.passwordHash ?? null,
  ownerType: room.ownerType,
  ownerId: room.ownerId,
  ownerName: room.ownerName,
  createdAt: room.createdAt,
  updatedAt: room.updatedAt,
  lastActiveAt: room.lastActiveAt,
  canvasState: {
    strokes: room.canvasState?.strokes ?? [],
    stickers: room.canvasState?.stickers ?? []
  }
});

export type RoomSummarySource = {
  roomId: string;
  name: string;
  visibility: RoomVisibility;
  ownerType: RoomOwnerType;
  ownerName: string;
  createdAt: Date | number;
  updatedAt: Date | number;
  lastActiveAt: Date | number;
};

export type RoomJoinSource = RoomSummarySource & {
  passwordHash?: string | null;
};

const toTimestamp = (value: Date | number): number => (value instanceof Date ? value.getTime() : value);

export const serializeRoomSummary = (room: RoomSummarySource, participants = 0) => ({
  roomId: room.roomId,
  name: room.name,
  visibility: room.visibility,
  owner: room.ownerName ? { type: room.ownerType, name: room.ownerName } : null,
  createdAt: toTimestamp(room.createdAt),
  updatedAt: toTimestamp(room.updatedAt),
  lastActiveAt: toTimestamp(room.lastActiveAt),
  participants
});

export const withNormalizedPasswordHash = (room: RoomJoinSource) => ({
  ...room,
  passwordHash: room.passwordHash ?? null
});
