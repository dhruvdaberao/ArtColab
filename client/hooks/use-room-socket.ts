'use client';

import { socket } from '@/lib/socket';
import type { Participant, RoomState, Stroke } from '@cloudcanvas/shared';
import { useEffect, useState } from 'react';

export function useRoomSocket(roomId: string, userId: string, displayName: string) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!userId) return;
    socket.connect();
    setStatus('connecting');

    socket.on('connect', () => {
      setStatus('connected');
      socket.emit('join_room', { roomId, userId, displayName });
    });

    socket.on('disconnect', () => setStatus('disconnected'));

    socket.on('room_joined', ({ room }: { room: RoomState }) => {
      setParticipants(room.participants);
      setStrokes(room.strokes);
      setExpired(false);
    });

    socket.on('room_state', ({ room }: { room: RoomState }) => {
      setParticipants(room.participants);
      setStrokes(room.strokes);
    });

    socket.on('participants_updated', ({ participants: next }: { participants: Participant[] }) => setParticipants(next));

    socket.on('draw_event', (event) => {
      if (event.type === 'draw_start') {
        setStrokes((prev) => [...prev, event.stroke]);
      }
      if (event.type === 'draw_move') {
        setStrokes((prev) =>
          prev.map((stroke) =>
            stroke.strokeId === event.strokeId ? { ...stroke, points: [...stroke.points, ...event.points] } : stroke
          )
        );
      }
    });

    socket.on('board_cleared', () => setStrokes([]));
    socket.on('stroke_undone', ({ strokeId }: { strokeId: string }) => {
      setStrokes((prev) => prev.filter((stroke) => stroke.strokeId !== strokeId));
    });
    socket.on('room_expired', () => setExpired(true));

    return () => {
      socket.emit('leave_room', { roomId });
      socket.off('connect');
      socket.off('disconnect');
      socket.off('room_joined');
      socket.off('room_state');
      socket.off('participants_updated');
      socket.off('draw_event');
      socket.off('board_cleared');
      socket.off('stroke_undone');
      socket.off('room_expired');
      socket.disconnect();
    };
  }, [roomId, userId, displayName]);

  return { participants, setParticipants, strokes, setStrokes, status, expired };
}
