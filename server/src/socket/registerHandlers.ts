import type { Server, Socket } from 'socket.io';
import type { DrawMovePayload, DrawStartPayload, ErrorPayload, Participant, Stroke } from '@cloudcanvas/shared';
import { SOCKET_EVENTS } from '@cloudcanvas/shared';
import { RoomManager } from '../rooms/roomManager.js';
import {
  drawEndSchema,
  drawMoveSchema,
  drawStartSchema,
  joinRoomSocketSchema,
  roomActionSchema,
  undoSchema
} from '../utils/validation.js';

const emitParticipants = (io: Server, roomId: string, participants: Participant[]) => {
  io.to(roomId).emit(SOCKET_EVENTS.ROOM_PARTICIPANTS_UPDATED, { roomId, participants });
};

const emitError = (socket: Socket, payload: ErrorPayload) => {
  socket.emit(SOCKET_EVENTS.ROOM_ERROR, payload);
};

export const registerSocketHandlers = (io: Server, roomManager: RoomManager) => {
  const leaveCurrentRoom = (socket: Socket, roomId?: string) => {
    const result = roomId ? roomManager.removeParticipantByRoom(roomId, socket.id) : roomManager.removeParticipant(socket.id);
    if (!result?.room) return;

    socket.leave(result.roomId);
    socket.to(result.roomId).emit(SOCKET_EVENTS.ROOM_PARTICIPANT_LEFT, {
      roomId: result.roomId,
      participant: result.participant
    });
    emitParticipants(io, result.roomId, result.room.participants);
  };

  io.on('connection', (socket: Socket) => {
    socket.on(SOCKET_EVENTS.ROOM_JOIN, (payload: unknown) => {
      const parsed = joinRoomSocketSchema.safeParse(payload);
      if (!parsed.success) {
        emitError(socket, { code: 'INVALID_PAYLOAD', message: 'Unable to join room with the provided details.' });
        return;
      }

      const room = roomManager.getRoom(parsed.data.roomId);
      if (!room) {
        socket.emit(SOCKET_EVENTS.ROOM_EXPIRED, { roomId: parsed.data.roomId });
        return;
      }

      const participant: Participant = {
        socketId: socket.id,
        userId: parsed.data.userId,
        displayName: parsed.data.displayName,
        joinedAt: Date.now()
      };

      socket.join(parsed.data.roomId);
      const updatedRoom = roomManager.addParticipant(parsed.data.roomId, participant);
      if (!updatedRoom) {
        emitError(socket, { code: 'ROOM_UNAVAILABLE', message: 'This room is no longer available.' });
        return;
      }

      socket.emit(SOCKET_EVENTS.ROOM_JOINED, { room: updatedRoom, participant });
      socket.to(parsed.data.roomId).emit(SOCKET_EVENTS.ROOM_PARTICIPANT_JOINED, { roomId: parsed.data.roomId, participant });
      emitParticipants(io, parsed.data.roomId, updatedRoom.participants);
    });

    socket.on(SOCKET_EVENTS.STROKE_START, (payload: DrawStartPayload) => {
      const parsed = drawStartSchema.safeParse(payload);
      if (!parsed.success) {
        emitError(socket, { code: 'INVALID_STROKE', message: 'Could not start stroke.' });
        return;
      }
      const room = roomManager.getRoom(parsed.data.roomId);
      if (!room) {
        socket.emit(SOCKET_EVENTS.ROOM_EXPIRED, { roomId: parsed.data.roomId });
        return;
      }
      const stroke: Stroke = { ...parsed.data.stroke, timestamp: Date.now() };
      roomManager.addStroke(parsed.data.roomId, stroke);
      socket.to(parsed.data.roomId).emit(SOCKET_EVENTS.STROKE_EVENT, { type: SOCKET_EVENTS.STROKE_START, stroke });
    });

    socket.on(SOCKET_EVENTS.STROKE_APPEND, (payload: DrawMovePayload) => {
      const parsed = drawMoveSchema.safeParse(payload);
      if (!parsed.success) {
        emitError(socket, { code: 'INVALID_STROKE', message: 'Could not append stroke points.' });
        return;
      }
      const appended = roomManager.appendStrokePoints(parsed.data.roomId, parsed.data.strokeId, parsed.data.points);
      if (!appended) return;
      socket.to(parsed.data.roomId).emit(SOCKET_EVENTS.STROKE_EVENT, {
        type: SOCKET_EVENTS.STROKE_APPEND,
        strokeId: parsed.data.strokeId,
        points: parsed.data.points
      });
    });

    socket.on(SOCKET_EVENTS.STROKE_END, (payload: unknown) => {
      const parsed = drawEndSchema.safeParse(payload);
      if (!parsed.success) return;
      socket.to(parsed.data.roomId).emit(SOCKET_EVENTS.STROKE_EVENT, {
        type: SOCKET_EVENTS.STROKE_END,
        strokeId: parsed.data.strokeId
      });
    });

    socket.on(SOCKET_EVENTS.BOARD_CLEAR, (payload: unknown) => {
      const parsed = roomActionSchema.safeParse(payload);
      if (!parsed.success) {
        emitError(socket, { code: 'INVALID_ROOM', message: 'Invalid room identifier.' });
        return;
      }
      const room = roomManager.clearBoard(parsed.data.roomId);
      if (!room) {
        socket.emit(SOCKET_EVENTS.ROOM_EXPIRED, { roomId: parsed.data.roomId });
        return;
      }
      io.to(parsed.data.roomId).emit(SOCKET_EVENTS.BOARD_CLEARED, { roomId: parsed.data.roomId });
    });

    socket.on(SOCKET_EVENTS.STROKE_UNDO, (payload: unknown) => {
      const parsed = undoSchema.safeParse(payload);
      if (!parsed.success) {
        emitError(socket, { code: 'INVALID_PAYLOAD', message: 'Unable to undo stroke.' });
        return;
      }
      const removed = roomManager.undoLastStroke(parsed.data.roomId, parsed.data.userId);
      if (!removed) return;
      io.to(parsed.data.roomId).emit(SOCKET_EVENTS.STROKE_UNDONE, {
        roomId: parsed.data.roomId,
        strokeId: removed.strokeId,
        userId: parsed.data.userId
      });
    });

    socket.on(SOCKET_EVENTS.ROOM_STATE_REQUEST, (payload: unknown) => {
      const parsed = roomActionSchema.safeParse(payload);
      if (!parsed.success) return;
      const room = roomManager.getRoom(parsed.data.roomId);
      if (!room) {
        socket.emit(SOCKET_EVENTS.ROOM_EXPIRED, { roomId: parsed.data.roomId });
        return;
      }
      socket.emit(SOCKET_EVENTS.ROOM_STATE, { room });
    });

    socket.on(SOCKET_EVENTS.ROOM_LEAVE, (payload: unknown) => {
      const parsed = roomActionSchema.safeParse(payload);
      if (!parsed.success) return;
      leaveCurrentRoom(socket, parsed.data.roomId);
    });

    socket.on('disconnect', () => {
      leaveCurrentRoom(socket);
    });
  });
};
