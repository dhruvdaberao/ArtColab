import type { RoomListItem, RoomResponse } from "./api";

const ROOM_ENTRY_HINT_KEY = "cloudcanvas-room-entry-hint";
const ROOM_ENTRY_HINT_TTL_MS = 2 * 60 * 1000;

type RoomEntryHint = {
  roomId: string;
  name: string;
  visibility: "public" | "private";
  createdAt?: number;
  updatedAt?: number;
  lastActiveAt?: number;
  expiresAt?: number | null;
  storedAt: number;
};

const isBrowser = () => typeof window !== "undefined";

const sanitizeHint = (value: unknown): RoomEntryHint | null => {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<RoomEntryHint>;
  if (
    typeof candidate.roomId !== "string" ||
    typeof candidate.name !== "string" ||
    (candidate.visibility !== "public" && candidate.visibility !== "private") ||
    typeof candidate.storedAt !== "number"
  ) {
    return null;
  }
  return {
    roomId: candidate.roomId.trim().toUpperCase(),
    name: candidate.name.trim(),
    visibility: candidate.visibility,
    createdAt:
      typeof candidate.createdAt === "number" ? candidate.createdAt : undefined,
    updatedAt:
      typeof candidate.updatedAt === "number" ? candidate.updatedAt : undefined,
    lastActiveAt:
      typeof candidate.lastActiveAt === "number"
        ? candidate.lastActiveAt
        : undefined,
    expiresAt:
      typeof candidate.expiresAt === "number" || candidate.expiresAt === null
        ? candidate.expiresAt
        : undefined,
    storedAt: candidate.storedAt,
  };
};

export const rememberRoomEntryHint = (
  room: Pick<
    RoomListItem,
    | "roomId"
    | "name"
    | "visibility"
    | "createdAt"
    | "updatedAt"
    | "lastActiveAt"
  >,
) => {
  if (!isBrowser()) return;
  const hint: RoomEntryHint = {
    roomId: room.roomId.trim().toUpperCase(),
    name: room.name.trim(),
    visibility: room.visibility,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    lastActiveAt: room.lastActiveAt,
    storedAt: Date.now(),
  };
  window.sessionStorage.setItem(ROOM_ENTRY_HINT_KEY, JSON.stringify(hint));
};

export const rememberRoomPageHint = (room: RoomResponse["room"]) => {
  if (!isBrowser()) return;
  const hint: RoomEntryHint = {
    roomId: room.roomId.trim().toUpperCase(),
    name: room.name.trim(),
    visibility: room.visibility,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    lastActiveAt: room.lastActiveAt,
    expiresAt: room.expiresAt,
    storedAt: Date.now(),
  };
  window.sessionStorage.setItem(ROOM_ENTRY_HINT_KEY, JSON.stringify(hint));
};

export const readRoomEntryHint = (roomId: string) => {
  if (!isBrowser()) return null;
  const raw = window.sessionStorage.getItem(ROOM_ENTRY_HINT_KEY);
  if (!raw) return null;
  try {
    const parsed = sanitizeHint(JSON.parse(raw));
    if (!parsed) return null;
    if (parsed.roomId !== roomId.trim().toUpperCase()) return null;
    if (Date.now() - parsed.storedAt > ROOM_ENTRY_HINT_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const clearRoomEntryHint = (roomId?: string) => {
  if (!isBrowser()) return;
  if (!roomId) {
    window.sessionStorage.removeItem(ROOM_ENTRY_HINT_KEY);
    return;
  }
  const hint = readRoomEntryHint(roomId);
  if (hint) window.sessionStorage.removeItem(ROOM_ENTRY_HINT_KEY);
};
