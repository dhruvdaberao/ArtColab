import type { Participant, RoomState } from '@cloudcanvas/shared';
import type { Stroke } from '@cloudcanvas/shared';
import { nanoid } from 'nanoid';
import { env } from '../config/env.js';

interface RoomInternal extends RoomState {
  pendingExpiryAt: number | null;
}

export class RoomManager {
  private rooms = new Map<string, RoomInternal>();

  createRoom(): RoomState {
    const roomId = nanoid(8).replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase();
    const now = Date.now();
    const room: RoomInternal = {
      roomId,
      createdAt: now,
      updatedAt: now,
      expiresAt: null,
      pendingExpiryAt: null,
      participants: [],
      strokes: []
    };
    this.rooms.set(roomId, room);
    return this.serialize(room);
  }

  getRoom(roomId: string): RoomState | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    if (this.isExpired(room)) {
      this.rooms.delete(roomId);
      return null;
    }
    return this.serialize(room);
  }

  addParticipant(roomId: string, participant: Participant): RoomState | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    room.participants = room.participants.filter((p) => p.socketId !== participant.socketId);
    room.participants.push(participant);
    room.updatedAt = Date.now();
    room.pendingExpiryAt = null;
    room.expiresAt = null;
    return this.serialize(room);
  }

  removeParticipant(socketId: string): { roomId: string; participant: Participant | null; room: RoomState | null } | null {
    for (const [roomId, room] of this.rooms) {
      const target = room.participants.find((participant) => participant.socketId === socketId);
      if (!target) continue;
      room.participants = room.participants.filter((participant) => participant.socketId !== socketId);
      room.updatedAt = Date.now();
      if (room.participants.length === 0) {
        room.pendingExpiryAt = Date.now() + env.ROOM_IDLE_TIMEOUT_MS;
        room.expiresAt = room.pendingExpiryAt;
      }
      return { roomId, participant: target, room: this.serialize(room) };
    }
    return null;
  }

  addStroke(roomId: string, stroke: Stroke): RoomState | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    room.strokes.push(stroke);
    if (room.strokes.length > env.MAX_STROKES_PER_ROOM) {
      room.strokes = room.strokes.slice(room.strokes.length - env.MAX_STROKES_PER_ROOM);
    }
    room.updatedAt = Date.now();
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
        this.rooms.delete(roomId);
        removed.push(roomId);
      }
    }
    return removed;
  }

  private isExpired(room: RoomInternal): boolean {
    return Boolean(room.pendingExpiryAt && room.pendingExpiryAt <= Date.now());
  }

  private serialize(room: RoomInternal): RoomState {
    return {
      roomId: room.roomId,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      expiresAt: room.pendingExpiryAt,
      participants: [...room.participants],
      strokes: room.strokes.map((stroke) => ({ ...stroke, points: [...stroke.points] }))
    };
  }
}
