import { socket } from '@/lib/socket';
import { SOCKET_EVENTS } from '@cloudcanvas/shared';
import type { ChatMessage, CursorPayload, Participant, RoomMode, RoomState, Stroke } from '@cloudcanvas/shared';
import { useCallback, useEffect, useState } from 'react';

export function useRoomSocket(roomId: string, userId: string, displayName: string, avatarUrl?: string) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [mode, setMode] = useState<RoomMode>('free-draw');
  const [cursors, setCursors] = useState<Record<string, CursorPayload>>({});
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [expired, setExpired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasJoined, setHasJoined] = useState(false);
  const [redoCounts, setRedoCounts] = useState<Record<string, number>>({});

  const leaveRoom = useCallback(() => { if (roomId) socket.emit(SOCKET_EVENTS.ROOM_LEAVE, { roomId }); setCursors({}); socket.disconnect(); }, [roomId]);

  useEffect(() => {
    if (!roomId || !userId) return;
    socket.connect(); setStatus('connecting'); setError(null); setHasJoined(false); setRedoCounts({});
    const onConnect = () => { setStatus('connected'); socket.emit(SOCKET_EVENTS.ROOM_JOIN, { roomId, userId, displayName, avatarUrl }); };
    const onDisconnect = () => setStatus('disconnected');
    const onConnectError = (connectError: Error) => { setStatus('disconnected'); setError(connectError.message || 'Unable to connect to collaboration server.'); };
    const applyRoom = (room: RoomState) => { setParticipants(room.participants); setStrokes(room.strokes); setChatMessages(room.chatMessages ?? []); setMode(room.mode ?? 'free-draw'); setRedoCounts({}); };
    const onRoomJoined = ({ room }: { room: RoomState }) => { applyRoom(room); setExpired(false); setHasJoined(true); };
    const onRoomState = ({ room }: { room: RoomState }) => applyRoom(room);
    const onCursorUpdate = (cursor: CursorPayload) => setCursors((prev) => ({ ...prev, [cursor.userId]: cursor }));
    const onCursorPresence = ({ cursors: next }: { roomId: string; cursors: CursorPayload[] }) => setCursors(Object.fromEntries(next.map((cursor) => [cursor.userId, cursor])));
    const onStrokeEvent = (event: any) => {
      if (event.type === SOCKET_EVENTS.STROKE_START) {
        setStrokes((prev) => [...prev, event.stroke]);
        setRedoCounts((prev) => ({ ...prev, [event.stroke.userId]: 0 }));
      }
      if (event.type === SOCKET_EVENTS.STROKE_APPEND) setStrokes((prev) => prev.map((stroke) => stroke.strokeId === event.strokeId ? { ...stroke, points: [...stroke.points, ...event.points] } : stroke));
    };
    socket.on('connect', onConnect); socket.on('disconnect', onDisconnect); socket.on('connect_error', onConnectError); socket.on(SOCKET_EVENTS.ROOM_JOINED, onRoomJoined); socket.on(SOCKET_EVENTS.ROOM_STATE, onRoomState); socket.on(SOCKET_EVENTS.ROOM_PARTICIPANTS_UPDATED, ({ participants: next }: { participants: Participant[] }) => setParticipants(next)); socket.on(SOCKET_EVENTS.CURSOR_UPDATE, onCursorUpdate); socket.on(SOCKET_EVENTS.CURSOR_PRESENCE, onCursorPresence);
    socket.on(SOCKET_EVENTS.STROKE_EVENT, onStrokeEvent);
    socket.on(SOCKET_EVENTS.CHAT_MESSAGE, ({ message }: { message: ChatMessage }) => setChatMessages((prev) => [...prev, message].slice(-80)));
    socket.on(SOCKET_EVENTS.MODE_UPDATED, ({ mode: nextMode }: { roomId: string; mode: RoomMode }) => setMode(nextMode));
    socket.on(SOCKET_EVENTS.BOARD_CLEARED, () => { setStrokes([]); setRedoCounts({}); });
    socket.on(SOCKET_EVENTS.STROKE_UNDONE, ({ strokeId, userId: strokeUserId }: { strokeId: string; userId: string }) => { setStrokes((prev) => prev.filter((stroke) => stroke.strokeId !== strokeId)); setRedoCounts((prev) => ({ ...prev, [strokeUserId]: (prev[strokeUserId] ?? 0) + 1 })); });
    socket.on(SOCKET_EVENTS.STROKE_REDONE, ({ stroke, userId: strokeUserId }: { stroke: Stroke; userId: string }) => { setStrokes((prev) => [...prev, stroke]); setRedoCounts((prev) => ({ ...prev, [strokeUserId]: Math.max(0, (prev[strokeUserId] ?? 0) - 1) })); });
    socket.on(SOCKET_EVENTS.ROOM_EXPIRED, () => setExpired(true));
    socket.on(SOCKET_EVENTS.ROOM_ERROR, ({ message }: { message: string }) => setError(message));
    return () => { if (roomId) socket.emit(SOCKET_EVENTS.ROOM_LEAVE, { roomId }); socket.off('connect', onConnect); socket.off('disconnect', onDisconnect); socket.off('connect_error', onConnectError); socket.off(SOCKET_EVENTS.ROOM_JOINED, onRoomJoined); socket.off(SOCKET_EVENTS.ROOM_STATE, onRoomState); socket.off(SOCKET_EVENTS.ROOM_PARTICIPANTS_UPDATED); socket.off(SOCKET_EVENTS.CURSOR_UPDATE, onCursorUpdate); socket.off(SOCKET_EVENTS.CURSOR_PRESENCE, onCursorPresence); socket.off(SOCKET_EVENTS.STROKE_EVENT, onStrokeEvent); socket.off(SOCKET_EVENTS.CHAT_MESSAGE); socket.off(SOCKET_EVENTS.MODE_UPDATED); socket.off(SOCKET_EVENTS.BOARD_CLEARED); socket.off(SOCKET_EVENTS.STROKE_UNDONE); socket.off(SOCKET_EVENTS.STROKE_REDONE); socket.off(SOCKET_EVENTS.ROOM_EXPIRED); socket.off(SOCKET_EVENTS.ROOM_ERROR); socket.disconnect(); };
  }, [roomId, userId, displayName, avatarUrl]);

  return { participants, setParticipants, strokes, setStrokes, chatMessages, setChatMessages, mode, setMode, cursors, status, expired, error, hasJoined, setError, leaveRoom, redoCount: redoCounts[userId] ?? 0 };
}
