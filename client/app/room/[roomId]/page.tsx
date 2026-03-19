"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Download, Link2, Redo2, Trash2, Undo2 } from "lucide-react";
import { nanoid } from "nanoid";
import { SOCKET_EVENTS } from "@cloudcanvas/shared";
import type { BrushStyle, DrawingTool } from "@cloudcanvas/shared";
import { CanvasBoard } from "@/components/canvas-board";
import { ConfirmModal } from "@/components/confirm-modal";
import { ParticipantsPanel } from "@/components/participants-panel";
import { ToastStack, type ToastMessage } from "@/components/toast";
import { Toolbar } from "@/components/toolbar";
import { Button, Card, SecondaryButton } from "@/components/ui";
import { getSocket } from "@/lib/socket";
import { useRoomSocket } from "@/hooks/use-room-socket";
import { getRoom, joinRoom } from "@/lib/api";
import { resolveSessionDisplayName } from "@/lib/guest";
import { useAuth } from "@/components/auth-provider";
import { UserAvatarMenu } from "@/components/user-avatar-menu";
import {
  grantRoomAccess,
  hasRoomAccessGrant,
  revokeRoomAccess,
} from "@/lib/room-access";

const REACTIONS = [
  { emoji: "❤️", label: "Appreciate" },
  { emoji: "😂", label: "Laugh" },
  { emoji: "😮", label: "Surprised" },
  { emoji: "🔥", label: "Fire" },
  { emoji: "🎉", label: "Celebrate" },
] as const;

const topButtonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-[color:var(--border)]/10 bg-white px-3 py-2 text-sm font-black text-[color:var(--text-main)] shadow-[0_8px_18px_rgba(15,23,42,0.08)] transition hover:bg-[color:var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-40";

export default function RoomPage() {
  const params = useParams<{ roomId?: string | string[] }>();
  const router = useRouter();
  const roomId = useMemo(() => {
    const candidate = Array.isArray(params.roomId)
      ? params.roomId[0]
      : params.roomId;
    return typeof candidate === "string" ? candidate.trim().toUpperCase() : "";
  }, [params.roomId]);
  const isValidRoomId = /^[A-Z0-9]{6}$/.test(roomId);
  const [tool, setTool] = useState<DrawingTool>("pen");
  const [brushStyle, setBrushStyle] = useState<BrushStyle>("classic");
  const [strokeColor, setStrokeColor] = useState("#111111");
  const [fillColor, setFillColor] = useState("#7dd3fc");
  const [fillEnabled, setFillEnabled] = useState(false);
  const [recentColors, setRecentColors] = useState<string[]>(["#111111"]);
  const [size, setSize] = useState(4);
  const [userId, setUserId] = useState("");
  const [displayName, setDisplayName] = useState("Guest");
  const [roomReady, setRoomReady] = useState(false);
  const [roomMeta, setRoomMeta] = useState<{
    roomId: string;
    name: string;
    visibility: "public" | "private";
  } | null>(null);
  const [roomLoadError, setRoomLoadError] = useState<string | null>(null);
  const [isRoomLoading, setIsRoomLoading] = useState(true);
  const [privateRoomPassword, setPrivateRoomPassword] = useState("");
  const [privateRoomError, setPrivateRoomError] = useState<string | null>(null);
  const [isUnlockingPrivateRoom, setIsUnlockingPrivateRoom] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [reactionBursts, setReactionBursts] = useState<
    Array<{ id: string; emoji: string; left: number }>
  >([]);
  const [isMobile, setIsMobile] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isPeopleOpen, setIsPeopleOpen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const joinedToastShownRef = useRef(false);
  const { user } = useAuth();

  const pushToast = useCallback((message: string) => {
    const id = nanoid();
    setToasts((prev) => [...prev, { id, message }]);
    window.setTimeout(
      () => setToasts((prev) => prev.filter((toast) => toast.id !== id)),
      1900,
    );
  }, []);

  const rememberColor = useCallback(
    (value: string) =>
      setRecentColors((prev) =>
        [value, ...prev.filter((item) => item !== value)].slice(0, 6),
      ),
    [],
  );

  const updateStrokeColor = useCallback(
    (value: string) => {
      setStrokeColor(value);
      rememberColor(value);
    },
    [rememberColor],
  );

  const updateFillColor = useCallback(
    (value: string) => {
      setFillColor(value);
      rememberColor(value);
    },
    [rememberColor],
  );

  useEffect(() => {
    const existing = localStorage.getItem("cloudcanvas-user-id");
    if (existing) setUserId(existing);
    else {
      const next = crypto.randomUUID();
      localStorage.setItem("cloudcanvas-user-id", next);
      setUserId(next);
    }
    setDisplayName(resolveSessionDisplayName(user));
  }, [user?.username, user]);

  useEffect(() => {
    if (!roomId) {
      setRoomLoadError("Missing room code.");
      setRoomReady(false);
      setRoomMeta(null);
      setIsRoomLoading(false);
      return;
    }
    if (!isValidRoomId) {
      setRoomLoadError("Invalid room code.");
      setRoomReady(false);
      setRoomMeta(null);
      setIsRoomLoading(false);
      return;
    }

    let cancelled = false;
    setRoomLoadError(null);
    setRoomReady(false);
    setIsRoomLoading(true);

    getRoom(roomId)
      .then((data) => {
        if (cancelled) return;
        setRoomMeta(data.room);
        if (
          data.room.visibility === "private" &&
          !hasRoomAccessGrant(data.room.roomId)
        ) {
          setRoomReady(false);
        } else {
          setRoomReady(true);
        }
        setIsRoomLoading(false);
      })
      .catch((error: Error) => {
        if (cancelled) return;
        console.error("[room-page] failed to load room", { roomId, error });
        setRoomMeta(null);
        setRoomLoadError(error.message || "Unable to load room.");
        setIsRoomLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [roomId, isValidRoomId]);

  useEffect(() => {
    joinedToastShownRef.current = false;
  }, [roomId]);

  useEffect(() => {
    if (roomMeta?.visibility !== "private") {
      setPrivateRoomPassword("");
      setPrivateRoomError(null);
      return;
    }

    if (hasRoomAccessGrant(roomMeta.roomId)) {
      setPrivateRoomError(null);
      setRoomReady(true);
      return;
    }

    setRoomReady(false);
  }, [roomMeta]);

  useEffect(() => {
    const updateViewportState = () => {
      const mobile = window.innerWidth < 1280;
      setIsMobile(mobile);
      if (!mobile) {
        setIsChatOpen(false);
        setIsPeopleOpen(false);
      }
    };

    updateViewportState();
    window.addEventListener("resize", updateViewportState);
    return () => window.removeEventListener("resize", updateViewportState);
  }, []);

  const avatarUrl = user?.profileImage;
  const {
    participants,
    strokes,
    setStrokes,
    chatMessages,
    mode,
    cursors,
    status,
    expired,
    error,
    hasJoined,
    leaveRoom: leaveSocketRoom,
    redoCount,
  } = useRoomSocket(
    roomReady ? roomId : "",
    roomReady ? userId : "",
    displayName,
    avatarUrl,
  );

  useEffect(() => {
    if (!chatEndRef.current) return;
    chatEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chatMessages, isChatOpen]);

  const canUndo = strokes.some((stroke) => stroke.userId === userId);
  const canRedo = redoCount > 0;
  const activeToolLabel = useMemo(() => {
    if (tool === "pen") return "Brush";
    if (tool === "eraser") return "Eraser";
    if (tool === "fill") return "Fill";
    return "Shape";
  }, [tool]);

  const clearBoard = () => {
    getSocket().emit(SOCKET_EVENTS.BOARD_CLEAR, { roomId });
    setStrokes([]);
    setIsClearModalOpen(false);
    pushToast("Board cleared for a fresh start.");
  };

  const download = () => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return;
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = (canvas as HTMLCanvasElement).width;
    exportCanvas.height = (canvas as HTMLCanvasElement).height + 50;
    const ctx = exportCanvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    ctx.drawImage(canvas as HTMLCanvasElement, 0, 0);
    ctx.fillStyle = "#111827";
    ctx.font = "bold 24px sans-serif";
    ctx.fillText("Made on Froddle", 16, exportCanvas.height - 14);
    const link = document.createElement("a");
    link.download = `froddle-${roomId}.png`;
    link.href = exportCanvas.toDataURL("image/png");
    link.click();
  };

  const sendChat = () => {
    const text = chatDraft.trim();
    if (!text) return;
    getSocket().emit(SOCKET_EVENTS.CHAT_SEND, {
      roomId,
      userId,
      displayName,
      avatarUrl,
      text: text.slice(0, 240),
    });
    setChatDraft("");
  };

  const pushReactionBurst = useCallback((id: string, emoji: string) => {
    setReactionBursts((prev) => {
      if (prev.some((burst) => burst.id === id)) return prev;
      return [
        ...prev,
        { id, emoji, left: Math.floor(Math.random() * 80) + 10 },
      ];
    });
    window.setTimeout(
      () =>
        setReactionBursts((prev) => prev.filter((burst) => burst.id !== id)),
      2300,
    );
  }, []);

  const sendReaction = (emoji: (typeof REACTIONS)[number]["emoji"]) => {
    getSocket().emit(SOCKET_EVENTS.REACTION_SEND, {
      roomId,
      userId,
      displayName,
      emoji,
    });
  };

  useEffect(() => {
    const onReaction = ({
      emoji,
      reactionId,
    }: {
      emoji: string;
      reactionId: string;
    }) => {
      pushReactionBurst(reactionId, emoji);
    };

    getSocket().on(SOCKET_EVENTS.REACTION_EVENT, onReaction);
    return () => {
      getSocket().off(SOCKET_EVENTS.REACTION_EVENT, onReaction);
    };
  }, [pushReactionBurst]);

  useEffect(() => {
    if (!hasJoined || joinedToastShownRef.current) return;
    pushToast(`Joined room ${roomId}.`);
    joinedToastShownRef.current = true;
  }, [hasJoined, pushToast, roomId]);

  useEffect(() => {
    const onParticipantJoined = ({
      participant,
    }: {
      participant: { displayName: string };
    }) => pushToast(`${participant.displayName} joined the room.`);
    const onParticipantLeft = ({
      participant,
    }: {
      participant: { displayName: string };
    }) => pushToast(`${participant.displayName} left the room.`);
    getSocket().on(SOCKET_EVENTS.ROOM_PARTICIPANT_JOINED, onParticipantJoined);
    getSocket().on(SOCKET_EVENTS.ROOM_PARTICIPANT_LEFT, onParticipantLeft);
    return () => {
      getSocket().off(
        SOCKET_EVENTS.ROOM_PARTICIPANT_JOINED,
        onParticipantJoined,
      );
      getSocket().off(SOCKET_EVENTS.ROOM_PARTICIPANT_LEFT, onParticipantLeft);
    };
  }, [pushToast]);

  const leaveRoomSafely = useCallback(async () => {
    leaveSocketRoom();
    revokeRoomAccess(roomId);
    setIsExitModalOpen(false);
    router.push("/");
  }, [leaveSocketRoom, roomId, router]);

  const unlockPrivateRoom = useCallback(async () => {
    if (!roomMeta || roomMeta.visibility !== "private") return;

    const password = privateRoomPassword.trim();
    if (!password) {
      setPrivateRoomError("Enter the room password to continue.");
      return;
    }

    try {
      setIsUnlockingPrivateRoom(true);
      setPrivateRoomError(null);
      await joinRoom({
        name: roomMeta.roomId,
        visibility: "private",
        password,
      });
      grantRoomAccess(roomMeta.roomId);
      setRoomReady(true);
      setPrivateRoomPassword("");
      pushToast(`Unlocked private room ${roomMeta.roomId}.`);
    } catch (joinError) {
      const message =
        joinError instanceof Error
          ? joinError.message
          : "Unable to unlock room.";
      setPrivateRoomError(message);
    } finally {
      setIsUnlockingPrivateRoom(false);
    }
  }, [privateRoomPassword, pushToast, roomMeta]);

  if (isRoomLoading)
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <Card className="max-w-md space-y-3 p-8 text-center">
          <h1 className="text-2xl font-semibold">Loading room</h1>
          <p className="text-slate-600">
            Checking the room link and loading the latest room details.
          </p>
        </Card>
      </main>
    );

  if (roomLoadError || expired)
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <Card className="max-w-md space-y-3 p-8 text-center">
          <h1 className="text-2xl font-semibold">Room unavailable</h1>
          <p className="text-slate-600">
            {roomLoadError || "This temporary room is no longer active."}
          </p>
          <Button className="mt-2" onClick={() => router.push("/")}>
            Go to home
          </Button>
        </Card>
      </main>
    );

  if (
    roomMeta?.visibility === "private" &&
    !roomReady &&
    !hasRoomAccessGrant(roomMeta.roomId)
  )
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <Card className="max-w-md space-y-4 p-8">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-semibold">Private room</h1>
            <p className="text-slate-600">
              Enter the password for{" "}
              {roomMeta.name || `room ${roomMeta.roomId}`} to start the live
              session.
            </p>
          </div>
          <input
            type="password"
            value={privateRoomPassword}
            onChange={(event) => setPrivateRoomPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !isUnlockingPrivateRoom) {
                void unlockPrivateRoom();
              }
            }}
            className="w-full rounded-2xl border-2 border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2.5 text-sm outline-none ring-0 transition focus:border-[color:var(--primary)] focus:shadow-[0_0_0_3px_rgba(28,117,188,0.16)]"
            placeholder="Room password"
          />
          {privateRoomError && (
            <p className="text-sm text-red-600">{privateRoomError}</p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              className="flex-1"
              onClick={() => void unlockPrivateRoom()}
              disabled={isUnlockingPrivateRoom}
            >
              {isUnlockingPrivateRoom ? "Unlocking..." : "Unlock room"}
            </Button>
            <SecondaryButton
              className="flex-1"
              onClick={() => router.push("/")}
            >
              Back home
            </SecondaryButton>
          </div>
        </Card>
      </main>
    );

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#eef5ff]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.95),_rgba(207,233,255,0.55)_45%,_rgba(173,214,255,0.35)_100%)]" />
      <div className="relative flex min-h-dvh flex-col">
        <header className="z-30 border-b border-white/40 bg-white/72 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl sm:px-4">
          <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setIsExitModalOpen(true)}
                  className={topButtonClass}
                >
                  <ArrowLeft size={18} />
                  <span className="hidden sm:inline">Exit</span>
                </button>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="truncate text-lg font-black text-[color:var(--text-main)] sm:text-2xl">
                      {roomMeta?.name || `Room ${roomId}`}
                    </h1>
                    <span className="inline-flex items-center rounded-full bg-[color:var(--surface-soft)] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[color:var(--text-main)]">
                      {roomMeta?.visibility ?? "public"}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${
                        status === "connected"
                          ? "bg-[#dcfce7] text-[#166534]"
                          : "bg-[#fee2e2] text-[#991b1b]"
                      }`}
                    >
                      {status}
                    </span>
                  </div>
                  <p className="truncate text-xs text-[color:var(--text-muted)] sm:text-sm">
                    Full-screen drawing workspace optimized for mobile and
                    desktop. Active tool: {activeToolLabel}.
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <div className="hidden items-center gap-2 sm:flex">
                  <button
                    type="button"
                    className={topButtonClass}
                    onClick={() =>
                      getSocket().emit(SOCKET_EVENTS.STROKE_UNDO, {
                        roomId,
                        userId,
                      })
                    }
                    disabled={!hasJoined || !canUndo}
                  >
                    <Undo2 size={16} />
                    Undo
                  </button>
                  <button
                    type="button"
                    className={topButtonClass}
                    onClick={() =>
                      getSocket().emit(SOCKET_EVENTS.STROKE_REDO, {
                        roomId,
                        userId,
                      })
                    }
                    disabled={!hasJoined || !canRedo}
                  >
                    <Redo2 size={16} />
                    Redo
                  </button>
                  <button
                    type="button"
                    className={topButtonClass}
                    onClick={download}
                    disabled={!hasJoined}
                  >
                    <Download size={16} />
                    Export
                  </button>
                  <button
                    type="button"
                    className={`${topButtonClass} bg-[#fff1f2] text-[#9f1239] hover:bg-[#ffe4e6]`}
                    onClick={() => setIsClearModalOpen(true)}
                    disabled={!hasJoined}
                  >
                    <Trash2 size={16} />
                    Clear
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    pushToast("Room link copied.");
                  }}
                  className={topButtonClass}
                >
                  <Link2 size={16} />
                  <span className="hidden sm:inline">Copy link</span>
                </button>
                <div className="hidden sm:block">
                  <UserAvatarMenu />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:hidden">
              <button
                type="button"
                className={topButtonClass}
                onClick={() =>
                  getSocket().emit(SOCKET_EVENTS.STROKE_UNDO, {
                    roomId,
                    userId,
                  })
                }
                disabled={!hasJoined || !canUndo}
              >
                <Undo2 size={16} />
                Undo
              </button>
              <button
                type="button"
                className={topButtonClass}
                onClick={() =>
                  getSocket().emit(SOCKET_EVENTS.STROKE_REDO, {
                    roomId,
                    userId,
                  })
                }
                disabled={!hasJoined || !canRedo}
              >
                <Redo2 size={16} />
                Redo
              </button>
              <button
                type="button"
                className={topButtonClass}
                onClick={download}
                disabled={!hasJoined}
              >
                <Download size={16} />
                Export
              </button>
              <button
                type="button"
                className={`${topButtonClass} bg-[#fff1f2] text-[#9f1239] hover:bg-[#ffe4e6]`}
                onClick={() => setIsClearModalOpen(true)}
                disabled={!hasJoined}
              >
                <Trash2 size={16} />
                Clear
              </button>
              <button
                type="button"
                className={topButtonClass}
                onClick={() => setIsPeopleOpen((value) => !value)}
              >
                {isPeopleOpen
                  ? "Hide people"
                  : `People (${participants.length})`}
              </button>
              <button
                type="button"
                className={topButtonClass}
                onClick={() => setIsChatOpen((value) => !value)}
              >
                {isChatOpen ? "Hide chat" : "Chat"}
              </button>
            </div>
          </div>
        </header>

        {(error || status !== "connected") && (
          <div className="z-20 mx-auto mt-3 w-full max-w-[1800px] px-3 sm:px-4">
            {error && (
              <div className="status-banner status-danger">{error}</div>
            )}
            {!error && status !== "connected" && (
              <div
                className={`status-banner ${
                  status === "reconnecting" || status === "disconnected"
                    ? "status-danger"
                    : ""
                }`}
              >
                {status === "connecting" &&
                  "Connecting to the collaboration server…"}
                {status === "reconnecting" &&
                  "Realtime connection dropped. Trying to reconnect…"}
                {status === "disconnected" &&
                  "Realtime connection is offline right now. We’ll reconnect automatically when possible."}
              </div>
            )}
          </div>
        )}

        <div className="mx-auto flex w-full max-w-[1800px] flex-1 gap-3 px-3 pb-[14.5rem] pt-3 sm:gap-4 sm:px-4 sm:pb-4">
          <section className="relative flex min-w-0 flex-1 flex-col gap-3">
            <div className="rounded-[2rem] border border-white/40 bg-white/42 p-2 shadow-[0_30px_60px_rgba(15,23,42,0.10)] backdrop-blur-sm sm:p-3">
              <div className="relative">
                <CanvasBoard
                  roomId={roomId}
                  userId={userId || "pending"}
                  displayName={displayName}
                  avatarUrl={avatarUrl}
                  tool={tool}
                  brushStyle={brushStyle}
                  color={strokeColor}
                  fillColor={fillColor}
                  fillEnabled={fillEnabled}
                  size={size}
                  strokes={strokes}
                  cursors={cursors}
                  setStrokes={setStrokes}
                  disabled={!hasJoined}
                  compact={isMobile}
                />
                {strokes.length === 0 && (
                  <div className="pointer-events-none absolute inset-x-0 top-4 z-10 flex justify-center px-4">
                    <div className="max-w-sm rounded-full bg-white/92 px-4 py-2 text-center text-xs font-semibold text-[color:var(--text-main)] shadow-[0_12px_24px_rgba(15,23,42,0.12)] sm:text-sm">
                      Tap the canvas to start drawing. Use the floating tool
                      panel for brush, eraser, shape, fill, and color options.
                    </div>
                  </div>
                )}
                <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[28px]">
                  {reactionBursts.map((burst) => (
                    <div
                      key={burst.id}
                      className="absolute bottom-4 text-2xl animate-[float-up_2.2s_ease-out_forwards] sm:bottom-6 sm:text-3xl"
                      style={{ left: `${burst.left}%` }}
                    >
                      {burst.emoji}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {REACTIONS.map(({ emoji, label }) => (
                <button
                  key={emoji}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/60 bg-white/82 px-3 text-lg shadow-[0_8px_16px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5"
                  onClick={() => sendReaction(emoji)}
                  aria-label={label}
                  title={label}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </section>

          <aside className="hidden w-[22rem] shrink-0 flex-col gap-4 xl:flex">
            <ParticipantsPanel participants={participants} userId={userId} />
            <div className="rounded-[1.75rem] border border-white/45 bg-white/80 p-4 shadow-[0_22px_45px_rgba(15,23,42,0.12)] backdrop-blur">
              <div className="mb-3">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
                  Room chat
                </p>
                <p className="mt-1 text-sm text-[color:var(--text-muted)]">
                  Quick messages without covering the drawing surface.
                </p>
              </div>
              <div className="max-h-64 space-y-2 overflow-y-auto rounded-[1.25rem] bg-[color:var(--bg-elevated)] p-3 text-sm text-[color:var(--text-main)]">
                {chatMessages.length === 0 ? (
                  <p className="text-xs text-[color:var(--text-muted)]">
                    No messages yet. Share feedback or coordinate with
                    collaborators.
                  </p>
                ) : (
                  chatMessages.map((message) => (
                    <div key={message.messageId}>
                      <span className="font-semibold text-[color:var(--text-main)]">
                        {message.displayName}
                      </span>
                      : <span>{message.text}</span>
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="mt-3 flex flex-col gap-2">
                <input
                  value={chatDraft}
                  onChange={(e) => setChatDraft(e.target.value.slice(0, 240))}
                  onKeyDown={(e) => e.key === "Enter" && sendChat()}
                  className="w-full rounded-2xl border border-[color:var(--border)]/10 bg-white px-3 py-3 text-sm outline-none transition focus:border-[color:var(--primary)] focus:shadow-[0_0_0_3px_rgba(28,117,188,0.16)]"
                  placeholder={
                    mode === "guess-mode"
                      ? "Guess the drawing..."
                      : "Send a message"
                  }
                />
                <button
                  onClick={sendChat}
                  className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-[color:var(--brand-blue)] px-4 py-2 text-sm font-black text-white shadow-[0_12px_24px_rgba(28,125,215,0.22)]"
                >
                  Send
                </button>
              </div>
            </div>
          </aside>
        </div>

        {isMobile && (isPeopleOpen || isChatOpen) && (
          <div className="fixed inset-x-0 top-[5.5rem] z-30 px-3">
            <div className="mx-auto flex max-w-5xl flex-col gap-3 rounded-[1.75rem] border border-white/55 bg-white/92 p-3 shadow-[0_22px_50px_rgba(15,23,42,0.16)] backdrop-blur">
              {isPeopleOpen && (
                <ParticipantsPanel
                  participants={participants}
                  userId={userId}
                />
              )}
              {isChatOpen && (
                <div className="rounded-[1.5rem] bg-[color:var(--bg-elevated)] p-3">
                  <div className="max-h-48 space-y-2 overflow-y-auto rounded-[1rem] bg-white p-3 text-sm">
                    {chatMessages.length === 0 ? (
                      <p className="text-xs text-[color:var(--text-muted)]">
                        No messages yet.
                      </p>
                    ) : (
                      chatMessages.map((message) => (
                        <div key={message.messageId}>
                          <span className="font-semibold">
                            {message.displayName}
                          </span>
                          :<span> {message.text}</span>
                        </div>
                      ))
                    )}
                    <div ref={chatEndRef} />
                  </div>
                  <div className="mt-3 flex gap-2">
                    <input
                      value={chatDraft}
                      onChange={(e) =>
                        setChatDraft(e.target.value.slice(0, 240))
                      }
                      onKeyDown={(e) => e.key === "Enter" && sendChat()}
                      className="min-w-0 flex-1 rounded-2xl border border-[color:var(--border)]/10 bg-white px-3 py-3 text-sm outline-none"
                      placeholder={
                        mode === "guess-mode"
                          ? "Guess the drawing..."
                          : "Send a message"
                      }
                    />
                    <button
                      onClick={sendChat}
                      className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-[color:var(--brand-blue)] px-4 py-2 text-sm font-black text-white"
                    >
                      Send
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 h-20 bg-gradient-to-t from-[#eef5ff] via-[#eef5ff]/85 to-transparent sm:hidden" />

        <Toolbar
          tool={tool}
          setTool={setTool}
          brushStyle={brushStyle}
          setBrushStyle={setBrushStyle}
          strokeColor={strokeColor}
          setStrokeColor={updateStrokeColor}
          fillColor={fillColor}
          setFillColor={updateFillColor}
          fillEnabled={fillEnabled}
          setFillEnabled={setFillEnabled}
          size={size}
          setSize={setSize}
          recentColors={recentColors}
          onUndo={() =>
            getSocket().emit(SOCKET_EVENTS.STROKE_UNDO, { roomId, userId })
          }
          onRedo={() =>
            getSocket().emit(SOCKET_EVENTS.STROKE_REDO, { roomId, userId })
          }
          onDownload={download}
          canUndo={canUndo}
          canRedo={canRedo}
          disabled={!hasJoined}
          mobile={isMobile}
        />
      </div>

      <ConfirmModal
        open={isClearModalOpen}
        title="Clear board?"
        description="This will remove all strokes for everyone in the room."
        confirmLabel="Clear board"
        cancelLabel="Cancel"
        destructive
        onCancel={() => setIsClearModalOpen(false)}
        onConfirm={clearBoard}
      />
      <ConfirmModal
        open={isExitModalOpen}
        title="Leave room?"
        description="Are you sure you want to leave this Froddle room?"
        confirmLabel="Leave"
        cancelLabel="Cancel"
        destructive
        onCancel={() => setIsExitModalOpen(false)}
        onConfirm={leaveRoomSafely}
      />
      <ToastStack toasts={toasts} />
    </main>
  );
}
