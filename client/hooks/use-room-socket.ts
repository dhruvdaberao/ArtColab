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

const cloneStroke = (stroke: Stroke): Stroke => ({
  ...stroke,
  points: stroke.points.map((point) => ({ ...point })),
  shape: stroke.shape
    ? {
        ...stroke.shape,
        start: { ...stroke.shape.start },
        end: { ...stroke.shape.end },
      }
    : undefined,
});

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
  const optimisticRedoRef = useRef<Map<string, Stroke[]>>(new Map());

  const leaveRoom = useCallback(() => {
    if (joinedRoomRef.current)
      getSocket().emit(SOCKET_EVENTS.ROOM_LEAVE, {
        roomId: joinedRoomRef.current,
      });
    joinedRoomRef.current = null;
    setCursors({});
    pendingAppendRef.current.clear();
    optimisticRedoRef.current.clear();
    if (appendFrameRef.current !== null) {
      clearTimeout(appendFrameRef.current);
      appendFrameRef.current = null;
    }
    getSocket().disconnect();
  }, []);

  const syncStrokeIndex = useCallback((nextStrokes: Stroke[]) => {
    strokeIndexRef.current = new Map(
      nextStrokes.map((stroke, index) => [stroke.strokeId, index]),
    );
  }, []);

  const applyOptimisticUndo = useCallback(() => {
    let removedStroke: Stroke | null = null;
    setStrokes((prev) => {
      for (let index = prev.length - 1; index >= 0; index -= 1) {
        const candidate = prev[index];
        if (candidate.userId !== userId) continue;
        removedStroke = cloneStroke(candidate);
        const next = [...prev.slice(0, index), ...prev.slice(index + 1)];
        syncStrokeIndex(next);
        pendingAppendRef.current.delete(candidate.strokeId);
        return next;
      }
      return prev;
    });

    if (!removedStroke) return false;
    const redoStack = optimisticRedoRef.current.get(userId) ?? [];
    redoStack.push(removedStroke);
    optimisticRedoRef.current.set(userId, redoStack.slice(-50));
    setRedoCounts((prev) => ({ ...prev, [userId]: redoStack.length }));
    latestRoomVersionRef.current = Date.now();
    getSocket().emit(SOCKET_EVENTS.STROKE_UNDO, { roomId, userId });
    return true;
  }, [roomId, syncStrokeIndex, userId]);

  const applyOptimisticRedo = useCallback(() => {
    const redoStack = optimisticRedoRef.current.get(userId) ?? [];
    const restored = redoStack.pop();
    if (!restored) return false;

    optimisticRedoRef.current.set(userId, redoStack);
    const stroke = cloneStroke(restored);
    setStrokes((prev) => {
      const next = [...prev, stroke];
      syncStrokeIndex(next);
      return next;
    });
    setRedoCounts((prev) => ({ ...prev, [userId]: redoStack.length }));
    latestRoomVersionRef.current = Math.max(
      latestRoomVersionRef.current,
      stroke.timestamp ?? Date.now(),
    );
    getSocket().emit(SOCKET_EVENTS.STROKE_REDO, { roomId, userId });
    return true;
  }, [roomId, syncStrokeIndex, userId]);

  useEffect(() => {
    if (!roomId || !userId) return;

    setStatus("connecting");
    setError(null);
    setHasJoined(false);
    setRedoCounts({});
    setExpired(false);
    latestRoomVersionRef.current = 0;
    optimisticRedoRef.current.clear();

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
      appendFrameRef.current = window.setTimeout(() => {
        flushPendingAppends();
      }, 8) as unknown as number;
    };

    const cancelAppendFlush = () => {
      if (appendFrameRef.current === null) return;
      clearTimeout(appendFrameRef.current);
      appendFrameRef.current = null;
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
      cancelAppendFlush();
      syncStrokeIndex(room.strokes);
      optimisticRedoRef.current.clear();
      setParticipants(room.participants);
      setStrokes(room.strokes);
      setChatMessages(room.chatMessages ?? []);
      setMode(room.mode ?? "free-draw");
      setRedoCounts({});
    };
    const onRoomJoined = ({ room }: { room: RoomState }) => {
      applyRoom(room, "room:joined");
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
        optimisticRedoRef.current.delete(event.stroke.userId);
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
          getSocket().emit(SOCKET_EVENTS.ROOM_STATE_REQUEST, { roomId });
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
      cancelAppendFlush();
      strokeIndexRef.current = new Map();
      optimisticRedoRef.current.clear();
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
          syncStrokeIndex(next);
          return next;
        });
        if (strokeUserId !== userId) {
          optimisticRedoRef.current.delete(strokeUserId);
          setRedoCounts((prev) => ({
            ...prev,
            [strokeUserId]: (prev[strokeUserId] ?? 0) + 1,
          }));
        }
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
          if (prev.some((existing) => existing.strokeId === stroke.strokeId)) {
            return prev;
          }
          const next = [...prev, stroke];
          syncStrokeIndex(next);
          return next;
        });
        if (strokeUserId !== userId) {
          optimisticRedoRef.current.delete(strokeUserId);
          setRedoCounts((prev) => ({
            ...prev,
            [strokeUserId]: Math.max(0, (prev[strokeUserId] ?? 0) - 1),
          }));
        }
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
      cancelAppendFlush();
      optimisticRedoRef.current.clear();
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
  }, [avatarUrl, displayName, roomId, syncStrokeIndex, userId]);

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
    undoStroke: applyOptimisticUndo,
    redoStroke: applyOptimisticRedo,
    redoCount: redoCounts[userId] ?? 0,
  };
}
