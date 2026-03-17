import type { Participant, RoomState } from '@cloudcanvas/shared';
import type { Stroke } from '@cloudcanvas/shared';
import { nanoid } from 'nanoid';
import { env } from '../config/env.js';

export type RoomVisibility = 'public' | 'private';

export interface RoomOwnership {
  ownerType: 'user' | 'guest';
  ownerId: string;
  ownerName: string;
}

interface RoomInternal extends RoomState {
  pendingExpiryAt: number | null;
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

const ROOM_CODE_REGEX = /[^A-Za-z0-9]/g;

export class RoomManager {
  private rooms = new Map<string, RoomInternal>();
  private socketToRoom = new Map<string, string>();
  private roomMeta = new Map<string, RoomMeta>();

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
      strokes: []
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
    if (this.isExpired(room)) {
      this.deleteRoom(roomId);
      return null;
    }
    return this.serialize(room);
  }

  listMeta(): RoomMeta[] {
    return Array.from(this.roomMeta.values()).sort((a, b) => b.createdAt - a.createdAt);
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

    if (room.participants.length === 0) {
      room.pendingExpiryAt = Date.now() + env.ROOM_IDLE_TIMEOUT_MS;
      room.expiresAt = room.pendingExpiryAt;
    }

    return { roomId, participant: target, room: this.serialize(room) };
  }

  addStroke(roomId: string, stroke: Stroke): RoomState | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    room.strokes.push(stroke);
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
    return this.serialize(room);
  }

  appendStrokePoints(roomId: string, strokeId: string, points: Stroke['points']): Stroke | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    const stroke = room.strokes.find((item) => item.strokeId === strokeId);
    if (!stroke) return null;
    stroke.points.push(...points);
    room.updatedAt = Date.now();
    return stroke;
  }

  clearBoard(roomId: string): RoomState | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    room.strokes = [];
    room.updatedAt = Date.now();
    return this.serialize(room);
  }

  undoLastStroke(roomId: string, userId: string): Stroke | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    for (let i = room.strokes.length - 1; i >= 0; i -= 1) {
      if (room.strokes[i].userId === userId) {
        const [removed] = room.strokes.splice(i, 1);
        room.updatedAt = Date.now();
        return removed;
      }
    }
    return null;
  }

  cleanupExpiredRooms(): string[] {
    const now = Date.now();
    const removed: string[] = [];
    for (const [roomId, room] of this.rooms) {
      if (room.pendingExpiryAt && room.pendingExpiryAt <= now) {
        this.deleteRoom(roomId);
        removed.push(roomId);
      }
    }
    return removed;
  }

  deleteRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.participants.forEach((participant) => {
      this.socketToRoom.delete(participant.socketId);
    });
    this.rooms.delete(roomId);
    this.roomMeta.delete(roomId);
  }

  private isExpired(room: RoomInternal): boolean {
    return Boolean(room.pendingExpiryAt && room.pendingExpiryAt <= Date.now());
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
      expiresAt: room.pendingExpiryAt,
      participants: [...room.participants],
      strokes: room.strokes.map((stroke) => ({ ...stroke, points: [...stroke.points] }))
    };
  }
}
