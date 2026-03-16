import type { Server, Socket } from 'socket.io';
import type { Participant, Stroke } from '@cloudcanvas/shared';
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
  io.to(roomId).emit('participants_updated', { roomId, participants });
};

export const registerSocketHandlers = (io: Server, roomManager: RoomManager) => {
  io.on('connection', (socket: Socket) => {
    socket.on('join_room', (payload) => {
      const parsed = joinRoomSocketSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit('error_event', { code: 'INVALID_PAYLOAD', message: 'Unable to join room.' });
        return;
      }

      const room = roomManager.getRoom(parsed.data.roomId);
      if (!room) {
        socket.emit('room_expired', { roomId: parsed.data.roomId });
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
        socket.emit('error_event', { code: 'ROOM_MISSING', message: 'Room unavailable.' });
        return;
      }

      socket.emit('room_joined', { room: updatedRoom, participant });
      socket.to(parsed.data.roomId).emit('user_joined', { roomId: parsed.data.roomId, participant });
      emitParticipants(io, parsed.data.roomId, updatedRoom.participants);
    });

    socket.on('draw_start', (payload) => {
      const parsed = drawStartSchema.safeParse(payload);
      if (!parsed.success) return;
      const room = roomManager.getRoom(parsed.data.roomId);
      if (!room) return;
      const stroke: Stroke = { ...parsed.data.stroke, timestamp: Date.now() };
      roomManager.addStroke(parsed.data.roomId, stroke);
      socket.to(parsed.data.roomId).emit('draw_event', { type: 'draw_start', stroke });
    });

    socket.on('draw_move', (payload) => {
      const parsed = drawMoveSchema.safeParse(payload);
      if (!parsed.success) return;
      const appended = roomManager.appendStrokePoints(parsed.data.roomId, parsed.data.strokeId, parsed.data.points);
      if (!appended) return;
      socket.to(parsed.data.roomId).emit('draw_event', {
        type: 'draw_move',
        strokeId: parsed.data.strokeId,
        points: parsed.data.points
      });
    });

    socket.on('draw_end', (payload) => {
      const parsed = drawEndSchema.safeParse(payload);
      if (!parsed.success) return;
      socket.to(parsed.data.roomId).emit('draw_event', { type: 'draw_end', strokeId: parsed.data.strokeId });
    });

    socket.on('clear_board', (payload) => {
      const parsed = roomActionSchema.safeParse(payload);
      if (!parsed.success) return;
      const room = roomManager.clearBoard(parsed.data.roomId);
      if (!room) return;
      io.to(parsed.data.roomId).emit('board_cleared', { roomId: parsed.data.roomId });
    });

    socket.on('undo_stroke', (payload) => {
      const parsed = undoSchema.safeParse(payload);
      if (!parsed.success) return;
      const removed = roomManager.undoLastStroke(parsed.data.roomId, parsed.data.userId);
      if (!removed) return;
      io.to(parsed.data.roomId).emit('stroke_undone', {
        roomId: parsed.data.roomId,
        strokeId: removed.strokeId,
        userId: parsed.data.userId
      });
    });

    socket.on('request_room_state', (payload) => {
      const parsed = roomActionSchema.safeParse(payload);
      if (!parsed.success) return;
      const room = roomManager.getRoom(parsed.data.roomId);
      if (!room) {
        socket.emit('room_expired', { roomId: parsed.data.roomId });
        return;
      }
      socket.emit('room_state', { room });
    });

    socket.on('leave_room', (payload) => {
      const parsed = roomActionSchema.safeParse(payload);
      if (!parsed.success) return;
      socket.leave(parsed.data.roomId);
      const result = roomManager.removeParticipant(socket.id);
      if (!result?.room) return;
      socket.to(parsed.data.roomId).emit('user_left', {
        roomId: parsed.data.roomId,
        participant: result.participant
      });
      emitParticipants(io, parsed.data.roomId, result.room.participants);
    });

    socket.on('disconnect', () => {
      const result = roomManager.removeParticipant(socket.id);
      if (!result?.room) return;
      socket.to(result.roomId).emit('user_left', { roomId: result.roomId, participant: result.participant });
      emitParticipants(io, result.roomId, result.room.participants);
    });
  });
};
