import { getSocket } from "@/lib/socket";
import { SOCKET_EVENTS } from "@cloudcanvas/shared";
import type {
  ChatMessage,
  CursorPayload,
  Participant,
  RoomMode,
  RoomState,
  Stroke,
} from "@cloudcanvas/shared";
import { useCallback, useEffect, useRef, useState } from "react";

export function useRoomSocket(
  roomId: string,
  userId: string,
  displayName: string,
  avatarUrl?: string,
) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [mode, setMode] = useState<RoomMode>("free-draw");
  const [cursors, setCursors] = useState<Record<string, CursorPayload>>({});
  const [status, setStatus] = useState<
    "connecting" | "connected" | "reconnecting" | "disconnected"
  >("connecting");
  const [expired, setExpired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasJoined, setHasJoined] = useState(false);
  const [redoCounts, setRedoCounts] = useState<Record<string, number>>({});
  const joinedRoomRef = useRef<string | null>(null);
  const latestRoomVersionRef = useRef(0);
  const strokeIndexRef = useRef<Map<string, number>>(new Map());
  const pendingAppendRef = useRef<Map<string, Stroke["points"]>>(new Map());
  const appendFrameRef = useRef<number | null>(null);

  const leaveRoom = useCallback(() => {
    if (joinedRoomRef.current)
      getSocket().emit(SOCKET_EVENTS.ROOM_LEAVE, {
        roomId: joinedRoomRef.current,
      });
    joinedRoomRef.current = null;
    setCursors({});
    pendingAppendRef.current.clear();
    if (appendFrameRef.current !== null) {
      cancelAnimationFrame(appendFrameRef.current);
      appendFrameRef.current = null;
    }
    getSocket().disconnect();
  }, []);

  useEffect(() => {
    if (!roomId || !userId) return;

    setStatus("connecting");
    setError(null);
    setHasJoined(false);
    setRedoCounts({});
    setExpired(false);
    latestRoomVersionRef.current = 0;

    const manager = getSocket().io;
    getSocket().connect();

    const flushPendingAppends = () => {
      appendFrameRef.current = null;
      if (!pendingAppendRef.current.size) return;
      const updates = new Map(pendingAppendRef.current);
      pendingAppendRef.current.clear();
      setStrokes((prev) => {
        let changed = false;
        const next = [...prev];
        for (const [strokeId, points] of Array.from(updates.entries())) {
          const strokeIndex = strokeIndexRef.current.get(strokeId);
          if (strokeIndex === undefined) continue;
          const target = next[strokeIndex];
          if (!target || !points.length) continue;
          changed = true;
          next[strokeIndex] = {
            ...target,
            points: [...target.points, ...points],
          };
        }
        return changed ? next : prev;
      });
    };

    const scheduleAppendFlush = () => {
      if (appendFrameRef.current !== null) return;
      appendFrameRef.current = requestAnimationFrame(flushPendingAppends);
    };

    const emitJoin = () => {
      console.info("[room-socket] emitting room join", { roomId, userId });
      getSocket().emit(SOCKET_EVENTS.ROOM_JOIN, {
        roomId,
        userId,
        displayName,
        avatarUrl,
      });
    };

    const requestRoomState = (reason: string) => {
      console.info("[room-socket] requesting room state", { roomId, reason });
      getSocket().emit(SOCKET_EVENTS.ROOM_STATE_REQUEST, { roomId });
    };

    const onConnect = () => {
      setStatus("connected");
      setError(null);
      emitJoin();
    };
    const onDisconnect = () =>
      setStatus(getSocket().active ? "reconnecting" : "disconnected");
    const onConnectError = (connectError: Error) => {
      setStatus(getSocket().active ? "reconnecting" : "disconnected");
      setError(
        connectError.message || "Unable to connect to collaboration server.",
      );
    };
    const onReconnectAttempt = () => {
      setStatus("reconnecting");
      setError("Trying to reconnect to the collaboration server…");
    };
    const onReconnect = () => {
      setStatus("connected");
      setError(null);
      emitJoin();
    };
    const applyRoom = (
      room: RoomState,
      source: "room:joined" | "room:state",
    ) => {
      if (
        latestRoomVersionRef.current > room.updatedAt &&
        source === "room:state"
      ) {
        console.warn("[room-socket] ignored stale room hydration", {
          roomId,
          source,
          incomingUpdatedAt: room.updatedAt,
          latestUpdatedAt: latestRoomVersionRef.current,
          strokeCount: room.strokes.length,
        });
        return;
      }
      latestRoomVersionRef.current = room.updatedAt;
      console.info("[room-socket] applying room hydration", {
        roomId,
        source,
        updatedAt: room.updatedAt,
        strokeCount: room.strokes.length,
        participantCount: room.participants.length,
      });
      joinedRoomRef.current = roomId;
      pendingAppendRef.current.clear();
      if (appendFrameRef.current !== null) {
        cancelAnimationFrame(appendFrameRef.current);
        appendFrameRef.current = null;
      }
      strokeIndexRef.current = new Map(
        room.strokes.map((stroke, index) => [stroke.strokeId, index]),
      );
      setParticipants(room.participants);
      setStrokes(room.strokes);
      setChatMessages(room.chatMessages ?? []);
      setMode(room.mode ?? "free-draw");
      setRedoCounts({});
    };
    const onRoomJoined = ({ room }: { room: RoomState }) => {
      applyRoom(room, "room:joined");
      requestRoomState("post-join-hydration");
      setExpired(false);
      setHasJoined(true);
    };
    const onRoomState = ({ room }: { room: RoomState }) =>
      applyRoom(room, "room:state");
    const onCursorUpdate = (cursor: CursorPayload) =>
      setCursors((prev) => ({ ...prev, [cursor.userId]: cursor }));
    const onCursorPresence = ({
      cursors: next,
    }: {
      roomId: string;
      cursors: CursorPayload[];
    }) =>
      setCursors(
        Object.fromEntries(next.map((cursor) => [cursor.userId, cursor])),
      );
    const onStrokeEvent = (event: any) => {
      if (event.type === SOCKET_EVENTS.STROKE_START) {
        setStrokes((prev) => {
          strokeIndexRef.current.set(event.stroke.strokeId, prev.length);
          return [...prev, event.stroke];
        });
        setRedoCounts((prev) => ({ ...prev, [event.stroke.userId]: 0 }));
        latestRoomVersionRef.current = Math.max(
          latestRoomVersionRef.current,
          event.stroke.timestamp ?? Date.now(),
        );
      }
      if (event.type === SOCKET_EVENTS.STROKE_APPEND) {
        if (!strokeIndexRef.current.has(event.strokeId)) {
          console.warn("[room-socket] append arrived before stroke hydration", {
            roomId,
            strokeId: event.strokeId,
            pointCount: event.points?.length ?? 0,
          });
          requestRoomState("missing-stroke-before-append");
          return;
        }
        const existing = pendingAppendRef.current.get(event.strokeId) ?? [];
        pendingAppendRef.current.set(event.strokeId, [
          ...existing,
          ...event.points,
        ]);
        scheduleAppendFlush();
      }
    };

    getSocket().on("connect", onConnect);
    getSocket().on("disconnect", onDisconnect);
    getSocket().on("connect_error", onConnectError);
    manager.on("reconnect_attempt", onReconnectAttempt);
    manager.on("reconnect", onReconnect);
    getSocket().on(SOCKET_EVENTS.ROOM_JOINED, onRoomJoined);
    getSocket().on(SOCKET_EVENTS.ROOM_STATE, onRoomState);
    getSocket().on(
      SOCKET_EVENTS.ROOM_PARTICIPANTS_UPDATED,
      ({ participants: next }: { participants: Participant[] }) =>
        setParticipants(next),
    );
    getSocket().on(SOCKET_EVENTS.CURSOR_UPDATE, onCursorUpdate);
    getSocket().on(SOCKET_EVENTS.CURSOR_PRESENCE, onCursorPresence);
    getSocket().on(SOCKET_EVENTS.STROKE_EVENT, onStrokeEvent);
    getSocket().on(
      SOCKET_EVENTS.CHAT_MESSAGE,
      ({ message }: { message: ChatMessage }) =>
        setChatMessages((prev) => [...prev, message].slice(-80)),
    );
    getSocket().on(
      SOCKET_EVENTS.MODE_UPDATED,
      ({ mode: nextMode }: { roomId: string; mode: RoomMode }) =>
        setMode(nextMode),
    );
    getSocket().on(SOCKET_EVENTS.BOARD_CLEARED, () => {
      latestRoomVersionRef.current = Date.now();
      console.info("[room-socket] board cleared", { roomId });
      pendingAppendRef.current.clear();
      if (appendFrameRef.current !== null) {
        cancelAnimationFrame(appendFrameRef.current);
        appendFrameRef.current = null;
      }
      strokeIndexRef.current = new Map();
      setStrokes([]);
      setRedoCounts({});
    });
    getSocket().on(
      SOCKET_EVENTS.STROKE_UNDONE,
      ({
        strokeId,
        userId: strokeUserId,
      }: {
        strokeId: string;
        userId: string;
      }) => {
        setStrokes((prev) => {
          pendingAppendRef.current.delete(strokeId);
          const next = prev.filter((stroke) => stroke.strokeId !== strokeId);
          strokeIndexRef.current = new Map(
            next.map((stroke, index) => [stroke.strokeId, index]),
          );
          return next;
        });
        setRedoCounts((prev) => ({
          ...prev,
          [strokeUserId]: (prev[strokeUserId] ?? 0) + 1,
        }));
        latestRoomVersionRef.current = Date.now();
      },
    );
    getSocket().on(
      SOCKET_EVENTS.STROKE_REDONE,
      ({
        stroke,
        userId: strokeUserId,
      }: {
        stroke: Stroke;
        userId: string;
      }) => {
        setStrokes((prev) => {
          strokeIndexRef.current.set(stroke.strokeId, prev.length);
          return [...prev, stroke];
        });
        setRedoCounts((prev) => ({
          ...prev,
          [strokeUserId]: Math.max(0, (prev[strokeUserId] ?? 0) - 1),
        }));
        latestRoomVersionRef.current = Math.max(
          latestRoomVersionRef.current,
          stroke.timestamp ?? Date.now(),
        );
      },
    );
    getSocket().on(SOCKET_EVENTS.ROOM_EXPIRED, () => setExpired(true));
    getSocket().on(
      SOCKET_EVENTS.ROOM_ERROR,
      ({ message }: { message: string }) => setError(message),
    );

    if (getSocket().connected) onConnect();

    return () => {
      pendingAppendRef.current.clear();
      if (appendFrameRef.current !== null) {
        cancelAnimationFrame(appendFrameRef.current);
        appendFrameRef.current = null;
      }
      if (joinedRoomRef.current)
        getSocket().emit(SOCKET_EVENTS.ROOM_LEAVE, {
          roomId: joinedRoomRef.current,
        });
      joinedRoomRef.current = null;
      getSocket().off("connect", onConnect);
      getSocket().off("disconnect", onDisconnect);
      getSocket().off("connect_error", onConnectError);
      manager.off("reconnect_attempt", onReconnectAttempt);
      manager.off("reconnect", onReconnect);
      getSocket().off(SOCKET_EVENTS.ROOM_JOINED, onRoomJoined);
      getSocket().off(SOCKET_EVENTS.ROOM_STATE, onRoomState);
      getSocket().off(SOCKET_EVENTS.ROOM_PARTICIPANTS_UPDATED);
      getSocket().off(SOCKET_EVENTS.CURSOR_UPDATE, onCursorUpdate);
      getSocket().off(SOCKET_EVENTS.CURSOR_PRESENCE, onCursorPresence);
      getSocket().off(SOCKET_EVENTS.STROKE_EVENT, onStrokeEvent);
      getSocket().off(SOCKET_EVENTS.CHAT_MESSAGE);
      getSocket().off(SOCKET_EVENTS.MODE_UPDATED);
      getSocket().off(SOCKET_EVENTS.BOARD_CLEARED);
      getSocket().off(SOCKET_EVENTS.STROKE_UNDONE);
      getSocket().off(SOCKET_EVENTS.STROKE_REDONE);
      getSocket().off(SOCKET_EVENTS.ROOM_EXPIRED);
      getSocket().off(SOCKET_EVENTS.ROOM_ERROR);
      getSocket().disconnect();
    };
  }, [roomId, userId, displayName, avatarUrl]);

  return {
    participants,
    setParticipants,
    strokes,
    setStrokes,
    chatMessages,
    setChatMessages,
    mode,
    setMode,
    cursors,
    status,
    expired,
    error,
    hasJoined,
    setError,
    leaveRoom,
    redoCount: redoCounts[userId] ?? 0,
  };
}
