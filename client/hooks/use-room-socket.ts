"use client";

import { socket } from "@/lib/socket";
import { SOCKET_EVENTS } from "@cloudcanvas/shared";
import type {
  CursorPayload,
  Participant,
  RoomState,
  Stroke,
} from "@cloudcanvas/shared";
import { useCallback, useEffect, useState } from "react";

export function useRoomSocket(
  roomId: string,
  userId: string,
  displayName: string,
  avatarUrl?: string,
) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [cursors, setCursors] = useState<Record<string, CursorPayload>>({});
  const [status, setStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("connecting");
  const [expired, setExpired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasJoined, setHasJoined] = useState(false);

  const leaveRoom = useCallback(() => {
    if (roomId) {
      socket.emit(SOCKET_EVENTS.ROOM_LEAVE, { roomId });
    }
    setCursors({});
    socket.disconnect();
  }, [roomId]);

  useEffect(() => {
    if (!roomId || !userId) return;

    socket.connect();
    setStatus("connecting");
    setError(null);
    setHasJoined(false);

    const onConnect = () => {
      setStatus("connected");
      socket.emit(SOCKET_EVENTS.ROOM_JOIN, {
        roomId,
        userId,
        displayName,
        avatarUrl,
      });
    };

    const onDisconnect = () => setStatus("disconnected");

    const onConnectError = (connectError: Error) => {
      setStatus("disconnected");
      setError(
        connectError.message || "Unable to connect to collaboration server.",
      );
    };

    const onRoomJoined = ({ room }: { room: RoomState }) => {
      setParticipants(room.participants);
      setStrokes(room.strokes);
      setExpired(false);
      setHasJoined(true);
    };

    const onRoomState = ({ room }: { room: RoomState }) => {
      setParticipants(room.participants);
      setStrokes(room.strokes);
    };

    const onCursorUpdate = (cursor: CursorPayload) => {
      setCursors((prev) => ({ ...prev, [cursor.userId]: cursor }));
    };

    const onCursorPresence = ({
      cursors: next,
    }: {
      roomId: string;
      cursors: CursorPayload[];
    }) => {
      setCursors(() =>
        Object.fromEntries(next.map((cursor) => [cursor.userId, cursor])),
      );
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on(SOCKET_EVENTS.ROOM_JOINED, onRoomJoined);
    socket.on(SOCKET_EVENTS.ROOM_STATE, onRoomState);
    socket.on(
      SOCKET_EVENTS.ROOM_PARTICIPANTS_UPDATED,
      ({ participants: next }: { participants: Participant[] }) =>
        setParticipants(next),
    );
    socket.on(SOCKET_EVENTS.CURSOR_UPDATE, onCursorUpdate);
    socket.on(SOCKET_EVENTS.CURSOR_PRESENCE, onCursorPresence);

    socket.on(SOCKET_EVENTS.STROKE_EVENT, (event) => {
      if (event.type === SOCKET_EVENTS.STROKE_START) {
        setStrokes((prev) => [...prev, event.stroke]);
      }
      if (event.type === SOCKET_EVENTS.STROKE_APPEND) {
        setStrokes((prev) =>
          prev.map((stroke) =>
            stroke.strokeId === event.strokeId
              ? { ...stroke, points: [...stroke.points, ...event.points] }
              : stroke,
          ),
        );
      }
    });

    socket.on(SOCKET_EVENTS.BOARD_CLEARED, () => setStrokes([]));
    socket.on(
      SOCKET_EVENTS.STROKE_UNDONE,
      ({ strokeId }: { strokeId: string }) => {
        setStrokes((prev) =>
          prev.filter((stroke) => stroke.strokeId !== strokeId),
        );
      },
    );
    socket.on(SOCKET_EVENTS.ROOM_EXPIRED, () => setExpired(true));
    socket.on(SOCKET_EVENTS.ROOM_ERROR, ({ message }: { message: string }) =>
      setError(message),
    );

    return () => {
      if (roomId) {
        socket.emit(SOCKET_EVENTS.ROOM_LEAVE, { roomId });
      }
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off(SOCKET_EVENTS.ROOM_JOINED, onRoomJoined);
      socket.off(SOCKET_EVENTS.ROOM_STATE, onRoomState);
      socket.off(SOCKET_EVENTS.ROOM_PARTICIPANTS_UPDATED);
      socket.off(SOCKET_EVENTS.CURSOR_UPDATE, onCursorUpdate);
      socket.off(SOCKET_EVENTS.CURSOR_PRESENCE, onCursorPresence);
      socket.off(SOCKET_EVENTS.STROKE_EVENT);
      socket.off(SOCKET_EVENTS.BOARD_CLEARED);
      socket.off(SOCKET_EVENTS.STROKE_UNDONE);
      socket.off(SOCKET_EVENTS.ROOM_EXPIRED);
      socket.off(SOCKET_EVENTS.ROOM_ERROR);
      socket.disconnect();
    };
  }, [roomId, userId, displayName, avatarUrl]);

  return {
    participants,
    setParticipants,
    strokes,
    setStrokes,
    cursors,
    status,
    expired,
    error,
    hasJoined,
    setError,
    leaveRoom,
  };
}
