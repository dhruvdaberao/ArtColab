"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { nanoid } from "nanoid";
import { SOCKET_EVENTS } from "@cloudcanvas/shared";
import type { BrushStyle, DrawingTool } from "@cloudcanvas/shared";
import { CanvasBoard } from "@/components/canvas-board";
import { FroddleLogoLink } from "@/components/froddle-logo";
import { ConfirmModal } from "@/components/confirm-modal";
import { ParticipantsPanel } from "@/components/participants-panel";
import { ToastStack, type ToastMessage } from "@/components/toast";
import { Toolbar } from "@/components/toolbar";
import { Badge, Button, Card, DangerButton, SecondaryButton } from "@/components/ui";
import { socket } from "@/lib/socket";
import { useRoomSocket } from "@/hooks/use-room-socket";
import { getRoom } from "@/lib/api";
import { resolveSessionDisplayName } from "@/lib/guest";
import { useAuth } from "@/components/auth-provider";
import { UserAvatarMenu } from "@/components/user-avatar-menu";

const REACTIONS = [
  { emoji: "❤️", label: "Appreciate" },
  { emoji: "😂", label: "Laugh" },
  { emoji: "😮", label: "Surprised" },
  { emoji: "🔥", label: "Fire" },
  { emoji: "🎉", label: "Celebrate" },
] as const;

export default function RoomPage() {
  const params = useParams<{ roomId: string }>();
  const router = useRouter();
  const roomId = useMemo(() => params.roomId.toUpperCase(), [params.roomId]);
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
  const [roomLoadError, setRoomLoadError] = useState<string | null>(null);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [reactionBursts, setReactionBursts] = useState<
    Array<{ id: string; emoji: string; left: number }>
  >([]);
  const [resetViewSignal, setResetViewSignal] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [isWorkspaceMode, setIsWorkspaceMode] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const joinedToastShownRef = useRef(false);
  const isMountedRef = useRef(true);
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
    if (!isValidRoomId)
      return (setRoomLoadError("Invalid room code."), setRoomReady(false));
    getRoom(roomId)
      .then(() => setRoomReady(true))
      .catch((error: Error) =>
        setRoomLoadError(error.message || "Room unavailable."),
      );
  }, [roomId, isValidRoomId]);

  useEffect(() => {
    const updateViewportState = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    updateViewportState();
    window.addEventListener("resize", updateViewportState);
    return () => window.removeEventListener("resize", updateViewportState);
  }, []);

  const resetWorkspaceMode = useCallback(
    async ({ preserveState = false }: { preserveState?: boolean } = {}) => {
      if (!preserveState && isMountedRef.current) setIsWorkspaceMode(false);
      const screenOrientation = window.screen.orientation as ScreenOrientation & {
        unlock?: () => void;
      };
      if (typeof screenOrientation.unlock === "function")
        screenOrientation.unlock();
      if (document.fullscreenElement) {
        try {
          await document.exitFullscreen();
        } catch {
          // noop
        }
      }
    },
    [],
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      void resetWorkspaceMode({ preserveState: true });
    };
  }, [resetWorkspaceMode]);

  useEffect(() => {
    if (!isMobile && isWorkspaceMode) void resetWorkspaceMode();
  }, [isMobile, isWorkspaceMode, resetWorkspaceMode]);

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
  }, [chatMessages]);

  const canUndo = strokes.some((stroke) => stroke.userId === userId);
  const canRedo = redoCount > 0;
  const showMobileLayout = isMobile;

  const clearBoard = () => {
    socket.emit(SOCKET_EVENTS.BOARD_CLEAR, { roomId });
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

  const copyImage = async () => {
    const canvas = document.querySelector("canvas") as HTMLCanvasElement | null;
    if (!canvas || !navigator.clipboard?.write) return;
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve),
    );
    if (!blob) return;
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    pushToast("Image copied to clipboard.");
  };

  const sendChat = () => {
    const text = chatDraft.trim();
    if (!text) return;
    socket.emit(SOCKET_EVENTS.CHAT_SEND, {
      roomId,
      userId,
      displayName,
      avatarUrl,
      text: text.slice(0, 240),
    });
    setChatDraft("");
  };

  const sendReaction = (emoji: (typeof REACTIONS)[number]["emoji"]) => {
    socket.emit(SOCKET_EVENTS.REACTION_SEND, {
      roomId,
      userId,
      displayName,
      emoji,
    });
    const id = nanoid();
    setReactionBursts((prev) => [
      ...prev,
      { id, emoji, left: 18 + Math.random() * 64 },
    ]);
    window.setTimeout(
      () =>
        setReactionBursts((prev) => prev.filter((burst) => burst.id !== id)),
      2200,
    );
  };

  useEffect(() => {
    const onReaction = ({
      emoji,
      reactionId,
    }: {
      emoji: string;
      reactionId: string;
    }) => {
      const burst = {
        id: reactionId,
        emoji,
        left: Math.floor(Math.random() * 80) + 10,
      };
      setReactionBursts((prev) => [...prev, burst]);
      window.setTimeout(
        () =>
          setReactionBursts((prev) =>
            prev.filter((item) => item.id !== burst.id),
          ),
        2300,
      );
    };

    socket.on(SOCKET_EVENTS.REACTION_EVENT, onReaction);
    return () => {
      socket.off(SOCKET_EVENTS.REACTION_EVENT, onReaction);
    };
  }, []);

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
    socket.on(SOCKET_EVENTS.ROOM_PARTICIPANT_JOINED, onParticipantJoined);
    socket.on(SOCKET_EVENTS.ROOM_PARTICIPANT_LEFT, onParticipantLeft);
    return () => {
      socket.off(SOCKET_EVENTS.ROOM_PARTICIPANT_JOINED, onParticipantJoined);
      socket.off(SOCKET_EVENTS.ROOM_PARTICIPANT_LEFT, onParticipantLeft);
    };
  }, [pushToast]);

  const enterWorkspaceMode = async () => {
    setIsWorkspaceMode(true);

    try {
      if (document.fullscreenElement == null)
        await document.documentElement.requestFullscreen();
    } catch {
      pushToast("Fullscreen unavailable on this device.");
    }

    const screenOrientation = window.screen.orientation as ScreenOrientation & {
      lock?: (orientation: string) => Promise<void>;
    };
    if (typeof screenOrientation.lock === "function") {
      try {
        await screenOrientation.lock("landscape");
        pushToast("Landscape workspace ready.");
        return;
      } catch {
        pushToast("Rotate your device for a wider drawing workspace.");
        return;
      }
    }

    pushToast("Rotate your device for a wider drawing workspace.");
  };

  const exitWorkspaceMode = async () => {
    await resetWorkspaceMode();
  };

  const leaveRoomSafely = useCallback(async () => {
    await resetWorkspaceMode();
    leaveSocketRoom();
    setIsExitModalOpen(false);
    router.push("/");
  }, [leaveSocketRoom, resetWorkspaceMode, router]);

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

  return (
    <main
      className={`overscroll-none px-3 py-3 sm:px-5 sm:py-6 ${isWorkspaceMode ? "min-h-dvh bg-[color:var(--bg)] pb-4" : "min-h-screen"}`}
    >
      <div
        className={`mx-auto flex w-full max-w-[1520px] flex-col ${isWorkspaceMode ? "gap-3" : "gap-4"}`}
      >
        <header className="flex flex-col gap-3 rounded-[24px] border-2 border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-3 shadow-[var(--shadow)] sm:rounded-[28px] sm:px-5 sm:py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <FroddleLogoLink imageClassName="max-w-[110px] sm:max-w-[130px]" />
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--text-muted)] sm:text-[11px]">
                  Froddle Room
                </p>
                <h1 className="text-lg font-black text-[color:var(--text-main)] sm:text-2xl">
                  {roomId}
                </h1>
              </div>
            </div>
            <div className="lg:hidden"><UserAvatarMenu /></div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pr-16 text-sm lg:justify-end lg:pr-0">
            <div className="hidden lg:block"><UserAvatarMenu /></div>
            <Badge className="capitalize border-[color:var(--border)] bg-[color:var(--accent)] text-[color:var(--text-main)]">
              {status}
            </Badge>
            {mode === "guess-mode" && (
              <Badge className="border-[color:var(--border)] bg-[#91d7ff] text-[color:var(--text-main)]">
                Guess mode active
              </Badge>
            )}
            <SecondaryButton
              className="min-h-10 px-3 text-xs sm:min-h-11 sm:text-sm"
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                pushToast("Room link copied.");
              }}
            >
              🔗 Copy room link
            </SecondaryButton>
            <DangerButton
              className="min-h-10 px-4 text-xs sm:min-h-11 sm:px-5 sm:text-sm"
              onClick={() => setIsExitModalOpen(true)}
            >
              🚪 Exit room
            </DangerButton>
          </div>
        </header>

        {error && <div className="status-banner status-danger">{error}</div>}
        {status !== "connected" && (
          <div className={`status-banner ${status === "reconnecting" || status === "disconnected" ? "status-danger" : ""}`}>
            {status === "connecting" && "Connecting to the collaboration server…"}
            {status === "reconnecting" && "Realtime connection dropped. Trying to reconnect…"}
            {status === "disconnected" && "Realtime connection is offline right now. We’ll reconnect automatically when possible."}
          </div>
        )}

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
          onClear={() => setIsClearModalOpen(true)}
          onUndo={() => socket.emit(SOCKET_EVENTS.STROKE_UNDO, { roomId, userId })}
          onRedo={() => socket.emit(SOCKET_EVENTS.STROKE_REDO, { roomId, userId })}
          onDownload={download}
          onCopyImage={copyImage}
          onResetView={() => setResetViewSignal((value) => value + 1)}
          canUndo={canUndo}
          canRedo={canRedo}
          disabled={!hasJoined}
          compact={showMobileLayout}
        />

        <section
          className={`grid gap-4 ${isWorkspaceMode ? "xl:grid-cols-[minmax(0,1.2fr)_340px]" : "2xl:grid-cols-[minmax(0,1fr)_320px]"}`}
        >
          <div className={`relative min-w-0 ${isWorkspaceMode ? "lg:order-1" : ""}`}>
            {isWorkspaceMode && showMobileLayout && (
              <div className="mb-2 flex flex-col gap-3 rounded-2xl border border-[color:var(--border)] bg-[#fff1a8] px-3 py-3 text-xs text-[color:var(--text-main)] shadow-sm sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-semibold">Landscape workspace is on</p>
                  <p className="mt-0.5">
                    Rotate your phone sideways for a larger canvas. If the browser
                    does not rotate automatically, the board still moves into a
                    landscape-style layout inside the app.
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-2 py-1 font-semibold"
                  onClick={exitWorkspaceMode}
                >
                  Back to normal view
                </button>
              </div>
            )}
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
              resetViewSignal={resetViewSignal}
              compact={showMobileLayout}
            />
            {strokes.length === 0 && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center p-4 sm:p-8">
                <div className="max-w-xs rounded-[24px] border-2 border-[color:var(--border)] bg-[color:var(--surface)]/95 px-5 py-4 text-center shadow-[var(--shadow)] sm:rounded-[28px] sm:px-6 sm:py-5">
                  <p className="text-sm font-semibold text-[color:var(--text-main)]">
                    Start drawing together
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--text-muted)]">
                    Brush, erase, sketch shapes, fill them, and zoom the board
                    without losing precision.
                  </p>
                </div>
              </div>
            )}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
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
            <div className="absolute left-2 right-2 top-3 z-10 flex flex-wrap justify-end gap-2 rounded-[1.25rem] border border-[color:var(--border)] bg-[color:var(--surface)]/95 p-2 shadow-sm sm:left-auto sm:right-3 sm:max-w-[260px]">
              {REACTIONS.map(({ emoji, label }) => (
                <button
                  key={emoji}
                  className="inline-flex h-10 min-w-10 items-center justify-center rounded-full border border-transparent bg-white text-lg transition hover:border-[color:var(--border)] hover:bg-[color:var(--surface-soft)]"
                  onClick={() => sendReaction(emoji)}
                  aria-label={label}
                  title={label}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div className={`space-y-4 ${isWorkspaceMode ? "lg:order-2" : ""}`}>
            <ParticipantsPanel participants={participants} userId={userId} />
            <Card className="space-y-3 bg-[color:var(--surface)] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-muted)]">
                Room chat
              </p>
              <div className="max-h-56 space-y-2 overflow-y-auto rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-3 text-sm text-[color:var(--text-main)]">
                {chatMessages.length === 0 ? (
                  <p className="text-xs text-[color:var(--text-muted)]">
                    No messages yet. Introduce the sketch or share feedback.
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
              <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                <input
                  value={chatDraft}
                  onChange={(e) => setChatDraft(e.target.value.slice(0, 240))}
                  onKeyDown={(e) => e.key === "Enter" && sendChat()}
                  className="flex-1 rounded-2xl border-2 border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2.5 text-sm outline-none ring-0 transition focus:border-[color:var(--primary)] focus:shadow-[0_0_0_3px_rgba(28,117,188,0.16)]"
                  placeholder={
                    mode === "guess-mode"
                      ? "Guess the drawing..."
                      : "Send a message"
                  }
                />
                <Button onClick={sendChat} className="min-h-10 sm:min-w-24">
                  💬 Send
                </Button>
              </div>
            </Card>
          </div>
        </section>
      </div>
      <SecondaryButton
        className="fixed bottom-4 right-4 z-[70] min-h-12 rounded-full px-4 text-sm sm:bottom-6 sm:right-6"
        onClick={isWorkspaceMode ? exitWorkspaceMode : enterWorkspaceMode}
      >
        <RefreshCw size={16} /> {isWorkspaceMode ? 'Normal view' : 'Rotate view'}
      </SecondaryButton>
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
