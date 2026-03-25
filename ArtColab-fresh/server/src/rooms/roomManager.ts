import type { ChatMessage, Participant, RoomMode, RoomState, Sticker, Stroke } from '@cloudcanvas/shared';
import { nanoid } from 'nanoid';
import { env } from '../config/env.js';

export type RoomVisibility = 'public' | 'private';

export interface RoomOwnership {
  ownerType: 'user' | 'guest';
  ownerId: string;
  ownerName: string;
}

interface RoomInternal extends RoomState {
  name: string;
  visibility: RoomVisibility;
  lastActiveAt: number;
  pendingExpiryAt: number | null;
  redoStacks: Map<string, Stroke[]>;
}

interface RoomMeta {
  roomId: string;
  name: string;
  visibility: RoomVisibility;
  passwordHash: string | null;
  createdAt: number;
  updatedAt: number;
  lastActiveAt: number;
  ownerType: 'user' | 'guest';
  ownerId: string;
  ownerName: string;
}

interface PersistState {
  strokes: Stroke[];
  stickers: Sticker[];
  updatedAt: Date;
  lastActiveAt: Date;
  lastSavedAt: Date;
}

const MAX_CHAT_MESSAGES = 80;
const MAX_STICKERS_PER_ROOM = 400;

const ROOM_CODE_REGEX = /[^A-Za-z0-9]/g;
const SAVE_DEBOUNCE_MS = 1500;

export class RoomManager {
  private rooms = new Map<string, RoomInternal>();
  private socketToRoom = new Map<string, string>();
  private roomMeta = new Map<string, RoomMeta>();
  private saveTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private persistRoomState?: (roomId: string, state: PersistState) => Promise<void>) {}

  hydrateFromStorage(
    rooms: Array<{
      roomId: string;
      name: string;
      visibility: RoomVisibility;
      passwordHash: string | null;
      ownerType: 'user' | 'guest';
      ownerId: string;
      ownerName: string;
      createdAt: Date;
      updatedAt: Date;
      lastActiveAt: Date;
      canvasState?: { strokes?: Stroke[]; stickers?: Sticker[] } | null;
    }>
  ): void {
    for (const item of rooms) {
      const room: RoomInternal = {
        roomId: item.roomId,
        name: item.name,
        visibility: item.visibility,
        createdAt: new Date(item.createdAt).getTime(),
        updatedAt: new Date(item.updatedAt).getTime(),
        lastActiveAt: new Date(item.lastActiveAt).getTime(),
        expiresAt: null,
        pendingExpiryAt: null,
        participants: [],
        strokes: (item.canvasState?.strokes ?? []).map((stroke) => ({ ...stroke, points: [...stroke.points] })),
        stickers: (item.canvasState?.stickers ?? []).map((sticker) => ({ ...sticker })),
        chatMessages: [],
        mode: 'free-draw',
        redoStacks: new Map()
      };
      this.rooms.set(room.roomId, room);
      this.roomMeta.set(room.roomId, {
        roomId: room.roomId,
        name: room.name,
        visibility: room.visibility,
        passwordHash: item.passwordHash,
        createdAt: room.createdAt,
        updatedAt: room.updatedAt,
        lastActiveAt: room.lastActiveAt,
        ownerType: item.ownerType,
        ownerId: item.ownerId,
        ownerName: item.ownerName
      });
    }
  }

  createRoom(input: { name: string; visibility: RoomVisibility; passwordHash: string | null; owner: RoomOwnership }): RoomState {
    const roomId = this.generateUniqueRoomId();
    const now = Date.now();
    const room: RoomInternal = {
      roomId,
      name: input.name,
      visibility: input.visibility,
      createdAt: now,
      updatedAt: now,
      lastActiveAt: now,
      expiresAt: null,
      pendingExpiryAt: null,
      participants: [],
      strokes: [],
      stickers: [],
      chatMessages: [],
      mode: 'free-draw',
      redoStacks: new Map()
    };
    this.rooms.set(roomId, room);
    this.roomMeta.set(roomId, {
      roomId,
      name: input.name,
      visibility: input.visibility,
      passwordHash: input.passwordHash,
      createdAt: now,
      updatedAt: now,
      lastActiveAt: now,
      ...input.owner
    });
    return this.serialize(room);
  }

  getMeta(roomId: string): RoomMeta | null {
    return this.roomMeta.get(roomId) ?? null;
  }

  getRoom(roomId: string): RoomState | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    return this.serialize(room);
  }

  listMeta(): RoomMeta[] {
    return Array.from(this.roomMeta.values()).sort((a, b) => b.createdAt - a.createdAt);
  }


  getRoomIdsForParticipant(userId: string): string[] {
    return Array.from(this.rooms.values())
      .filter((room) => room.participants.some((participant) => participant.userId === userId))
      .map((room) => room.roomId);
  }

  transferRoomOwnership(fromOwnerId: string, owner: RoomOwnership): string[] {
    const transferred: string[] = [];
    for (const meta of this.roomMeta.values()) {
      if (meta.ownerId !== fromOwnerId || meta.ownerType !== 'guest') continue;
      meta.ownerId = owner.ownerId;
      meta.ownerType = owner.ownerType;
      meta.ownerName = owner.ownerName;
      meta.updatedAt = Date.now();
      transferred.push(meta.roomId);
    }
    return transferred;
  }

  addParticipant(roomId: string, participant: Participant): RoomState | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    room.participants = room.participants.filter((p) => p.socketId !== participant.socketId);
    room.participants.push(participant);
    room.updatedAt = Date.now();
    room.lastActiveAt = room.updatedAt;
    room.pendingExpiryAt = null;
    room.expiresAt = null;
    this.socketToRoom.set(participant.socketId, roomId);

    const meta = this.roomMeta.get(roomId);
    if (meta) {
      meta.lastActiveAt = room.updatedAt;
      meta.updatedAt = room.updatedAt;
    }

    return this.serialize(room);
  }

  removeParticipant(socketId: string): { roomId: string; participant: Participant | null; room: RoomState | null } | null {
    const roomId = this.socketToRoom.get(socketId);
    if (!roomId) return null;
    return this.removeParticipantByRoom(roomId, socketId);
  }

  removeParticipantByRoom(
    roomId: string,
    socketId: string
  ): { roomId: string; participant: Participant | null; room: RoomState | null } | null {
    const room = this.rooms.get(roomId);
    if (!room) {
      this.socketToRoom.delete(socketId);
      return null;
    }

    const target = room.participants.find((participant) => participant.socketId === socketId);
    if (!target) {
      this.socketToRoom.delete(socketId);
      return null;
    }

    room.participants = room.participants.filter((participant) => participant.socketId !== socketId);
    this.socketToRoom.delete(socketId);
    room.updatedAt = Date.now();

    return { roomId, participant: target, room: this.serialize(room) };
  }

  addStroke(roomId: string, stroke: Stroke): RoomState | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    room.strokes.push(stroke);
    room.redoStacks.delete(stroke.userId);
    if (room.strokes.length > env.MAX_STROKES_PER_ROOM) {
      room.strokes = room.strokes.slice(room.strokes.length - env.MAX_STROKES_PER_ROOM);
    }
    room.updatedAt = Date.now();
    room.lastActiveAt = room.updatedAt;
    const meta = this.roomMeta.get(roomId);
    if (meta) {
      meta.lastActiveAt = room.updatedAt;
      meta.updatedAt = room.updatedAt;
    }
    this.schedulePersist(roomId);
    return this.serialize(room);
  }

  appendStrokePoints(roomId: string, strokeId: string, points: Stroke['points']): Stroke | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    const stroke = room.strokes.find((item) => item.strokeId === strokeId);
    if (!stroke) return null;
    stroke.points.push(...points);
    room.updatedAt = Date.now();
    this.schedulePersist(roomId);
    return stroke;
  }

  clearBoard(roomId: string): RoomState | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    room.strokes = [];
    room.stickers = [];
    room.redoStacks.clear();
    room.updatedAt = Date.now();
    this.schedulePersist(roomId, true);
    return this.serialize(room);
  }

  addSticker(roomId: string, sticker: Sticker): RoomState | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    room.stickers.push(sticker);
    if (room.stickers.length > MAX_STICKERS_PER_ROOM) {
      room.stickers = room.stickers.slice(room.stickers.length - MAX_STICKERS_PER_ROOM);
    }
    room.updatedAt = Date.now();
    room.lastActiveAt = room.updatedAt;
    this.schedulePersist(roomId);
    return this.serialize(room);
  }

  addChatMessage(roomId: string, message: ChatMessage): ChatMessage | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    room.chatMessages.push(message);
    if (room.chatMessages.length > MAX_CHAT_MESSAGES) {
      room.chatMessages = room.chatMessages.slice(room.chatMessages.length - MAX_CHAT_MESSAGES);
    }
    room.updatedAt = Date.now();
    room.lastActiveAt = room.updatedAt;
    return message;
  }

  setMode(roomId: string, mode: RoomMode): RoomState | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    room.mode = mode;
    room.updatedAt = Date.now();
    return this.serialize(room);
  }

  undoLastStroke(roomId: string, userId: string): Stroke | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    for (let i = room.strokes.length - 1; i >= 0; i -= 1) {
      if (room.strokes[i].userId === userId) {
        const [removed] = room.strokes.splice(i, 1);
        const redoStack = room.redoStacks.get(userId) ?? [];
        redoStack.push({ ...removed, points: [...removed.points] });
        room.redoStacks.set(userId, redoStack.slice(-50));
        room.updatedAt = Date.now();
        this.schedulePersist(roomId);
        return removed;
      }
    }
    return null;
  }

  redoLastStroke(roomId: string, userId: string): Stroke | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    const redoStack = room.redoStacks.get(userId);
    const restored = redoStack?.pop();
    if (!restored) return null;
    room.strokes.push({ ...restored, points: [...restored.points] });
    room.updatedAt = Date.now();
    room.lastActiveAt = room.updatedAt;
    this.schedulePersist(roomId);
    return restored;
  }

  cleanupExpiredRooms(): string[] {
    return [];
  }

  deleteRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.participants.forEach((participant) => {
      this.socketToRoom.delete(participant.socketId);
    });
    this.rooms.delete(roomId);
    this.roomMeta.delete(roomId);
    const existingTimer = this.saveTimers.get(roomId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.saveTimers.delete(roomId);
    }
  }

  private schedulePersist(roomId: string, immediate = false): void {
    if (!this.persistRoomState) return;

    const existing = this.saveTimers.get(roomId);
    if (existing) {
      clearTimeout(existing);
      this.saveTimers.delete(roomId);
    }

    const persistNow = () => {
      this.saveTimers.delete(roomId);
      this.persist(roomId);
    };

    if (immediate) {
      persistNow();
      return;
    }

    const timer = setTimeout(persistNow, SAVE_DEBOUNCE_MS);
    timer.unref();
    this.saveTimers.set(roomId, timer);
  }

  private persist(roomId: string): void {
    if (!this.persistRoomState) return;
    const room = this.rooms.get(roomId);
    if (!room) return;

    this.persistRoomState(roomId, {
      strokes: room.strokes.map((stroke) => ({ ...stroke, points: [...stroke.points] })),
      stickers: room.stickers.map((sticker) => ({ ...sticker })),
      updatedAt: new Date(room.updatedAt),
      lastActiveAt: new Date(room.lastActiveAt),
      lastSavedAt: new Date()
    }).catch((error) => {
      console.error('[room:persist] failed', { roomId, error });
    });
  }

  private generateUniqueRoomId(): string {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const roomId = nanoid(8).replace(ROOM_CODE_REGEX, '').slice(0, 6).toUpperCase();
      if (roomId.length === 6 && !this.rooms.has(roomId)) {
        return roomId;
      }
    }

    const fallback = Date.now().toString(36).toUpperCase().slice(-6).padStart(6, 'A');
    if (!this.rooms.has(fallback)) return fallback;

    for (let suffix = 0; suffix < 100; suffix += 1) {
      const candidate = `${fallback.slice(0, 4)}${suffix.toString().padStart(2, '0')}`;
      if (!this.rooms.has(candidate)) return candidate;
    }

    throw new Error('Unable to generate room id');
  }

  private serialize(room: RoomInternal): RoomState {
    return {
      roomId: room.roomId,
      name: room.name,
      visibility: room.visibility,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      lastActiveAt: room.lastActiveAt,
      expiresAt: null,
      participants: [...room.participants],
      strokes: room.strokes.map((stroke) => ({ ...stroke, points: [...stroke.points] })),
      stickers: room.stickers.map((sticker) => ({ ...sticker })),
      chatMessages: room.chatMessages.map((message) => ({ ...message })),
      mode: room.mode
    };
  }
}
