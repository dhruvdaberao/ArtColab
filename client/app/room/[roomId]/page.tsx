"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  CircleAlert,
  DoorOpen,
  Flame,
  Heart,
  Info,
  Link as LinkIcon,
  Maximize,
  Minimize,
  PartyPopper,
  Smile,
} from "lucide-react";
import { nanoid } from "nanoid";
import { SOCKET_EVENTS } from "@cloudcanvas/shared";
import type { BrushStyle, DrawingTool } from "@cloudcanvas/shared";
import { CanvasBoard } from "@/components/canvas-board";
import { ConfirmModal } from "@/components/confirm-modal";
import { ParticipantsPanel } from "@/components/participants-panel";
import { ToastStack, type ToastMessage } from "@/components/toast";
import { Toolbar } from "@/components/toolbar";
import { Badge, Button, Card, SecondaryButton } from "@/components/ui";
import { socket } from "@/lib/socket";
import { useRoomSocket } from "@/hooks/use-room-socket";
import { getRoom } from "@/lib/api";
import { resolveSessionDisplayName } from "@/lib/guest";
import { useAuth } from "@/components/auth-provider";
import { UserAvatarMenu } from "@/components/user-avatar-menu";

const REACTIONS = [
  { emoji: "❤️", label: "Appreciate", Icon: Heart },
  { emoji: "😂", label: "Laugh", Icon: Smile },
  { emoji: "😮", label: "Surprised", Icon: CircleAlert },
  { emoji: "🔥", label: "Fire", Icon: Flame },
  { emoji: "🎉", label: "Celebrate", Icon: PartyPopper },
] as const;

export default function RoomPage() {
  const params = useParams<{ roomId: string }>();
  const router = useRouter();
  const roomId = useMemo(() => params.roomId.toUpperCase(), [params.roomId]);
  const isValidRoomId = /^[A-Z0-9]{6}$/.test(roomId);
  const [tool, setTool] = useState<DrawingTool>("pen");
  const [brushStyle, setBrushStyle] = useState<BrushStyle>("classic");
  const [strokeColor, setStrokeColor] = useState("#0f172a");
  const [fillColor, setFillColor] = useState("#bfdbfe");
  const [fillEnabled, setFillEnabled] = useState(false);
  const [recentColors, setRecentColors] = useState<string[]>(["#0f172a"]);
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
  const [isPortrait, setIsPortrait] = useState(false);
  const [isWorkspaceMode, setIsWorkspaceMode] = useState(false);
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const [mobileInfoOpen, setMobileInfoOpen] = useState(false);
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
      setIsPortrait(window.matchMedia("(orientation: portrait)").matches);
    };

    updateViewportState();
    window.addEventListener("resize", updateViewportState);
    return () => window.removeEventListener("resize", updateViewportState);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setIsWorkspaceMode(false);
      setMobileToolsOpen(false);
      setMobileInfoOpen(false);
    }
  }, [isMobile]);

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
  const showRotatePrompt = showMobileLayout && isPortrait;
  const showWorkspaceBanner = isWorkspaceMode && showRotatePrompt;

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
    ctx.fillText("Made on Art Colab", 16, exportCanvas.height - 14);
    const link = document.createElement("a");
    link.download = `art-colab-${roomId}.png`;
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
    setMobileToolsOpen(false);
    setMobileInfoOpen(false);

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
    setIsWorkspaceMode(false);
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
  };

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
        <header
          className={`flex flex-col gap-3 rounded-[24px] border-2 border-[color:var(--border)] bg-[color:var(--surface)]/95 px-3 py-3 shadow-[var(--shadow)] sm:rounded-[28px] sm:px-5 sm:py-4 ${isWorkspaceMode ? "sm:px-4 sm:py-3" : ""} lg:flex-row lg:items-center lg:justify-between`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--text-muted)] sm:text-[11px]">
                Art Colab Room
              </p>
              <h1 className="text-lg font-semibold text-[color:var(--text-main)] sm:text-2xl">
                {roomId}
              </h1>
            </div>
            {showMobileLayout && isWorkspaceMode && (
              <SecondaryButton
                className="min-h-9 px-3 text-xs sm:hidden"
                onClick={exitWorkspaceMode}
              >
                <Minimize size={14} /> Normal view
              </SecondaryButton>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <UserAvatarMenu />
            <Badge className="capitalize border-[color:var(--border)] bg-[color:var(--accent)]/55 text-[color:var(--text-main)]">
              {status}
            </Badge>
            {!showMobileLayout && (
              <Badge className="border-[color:var(--border)] bg-[color:var(--surface-soft)] text-[color:var(--text-main)]">
                {mode === "guess-mode" ? "Guess mode active" : "Free draw"}
              </Badge>
            )}
            <SecondaryButton
              className="min-h-10 px-3 text-xs sm:min-h-11 sm:text-sm"
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                pushToast("Room link copied.");
              }}
            >
              <LinkIcon size={16} /> Copy room link
            </SecondaryButton>
            {!showMobileLayout && isWorkspaceMode && (
              <SecondaryButton
                className="min-h-11"
                onClick={exitWorkspaceMode}
              >
                <Minimize size={16} /> Normal view
              </SecondaryButton>
            )}
            <Button
              className="min-h-10 gap-2 bg-[color:var(--danger)] px-4 text-xs text-[color:var(--surface)] hover:bg-[#834145] sm:min-h-11 sm:px-5 sm:text-sm"
              onClick={() => setIsExitModalOpen(true)}
            >
              <DoorOpen size={16} /> Exit room
            </Button>
          </div>
        </header>

        {error && (
          <div className="status-banner status-danger">
            {error}
          </div>
        )}

        {showMobileLayout && (
          <div className="flex flex-wrap gap-2">
            <Button
              className="min-h-10 flex-1 gap-2 px-3 text-xs sm:text-sm"
              onClick={() => setMobileToolsOpen((value) => !value)}
            >
              {mobileToolsOpen ? (
                <ChevronUp size={16} />
              ) : (
                <ChevronDown size={16} />
              )}{" "}
              {mobileToolsOpen ? "Hide tools" : "Show tools"}
            </Button>
            {showRotatePrompt && (
              <SecondaryButton
                className="min-h-10 flex-1 gap-2 px-3 text-xs sm:text-sm"
                onClick={
                  isWorkspaceMode ? exitWorkspaceMode : enterWorkspaceMode
                }
              >
                {isWorkspaceMode ? (
                  <Minimize size={16} />
                ) : (
                  <Maximize size={16} />
                )}{" "}
                {isWorkspaceMode
                  ? "Exit landscape workspace"
                  : "Rotate for better drawing"}
              </SecondaryButton>
            )}
            <SecondaryButton
              className="min-h-10 flex-1 gap-2 px-3 text-xs sm:text-sm"
              onClick={() => setMobileInfoOpen((value) => !value)}
            >
              <Info size={16} /> {mobileInfoOpen ? "Hide room info" : "Room info & chat"}
            </SecondaryButton>
          </div>
        )}

        {(!showMobileLayout || mobileToolsOpen || isWorkspaceMode) && (
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
            onUndo={() =>
              socket.emit(SOCKET_EVENTS.STROKE_UNDO, { roomId, userId })
            }
            onRedo={() =>
              socket.emit(SOCKET_EVENTS.STROKE_REDO, { roomId, userId })
            }
            onDownload={download}
            onCopyImage={copyImage}
            onResetView={() => setResetViewSignal((value) => value + 1)}
            canUndo={canUndo}
            canRedo={canRedo}
            disabled={!hasJoined}
            compact={showMobileLayout}
          />
        )}

        <section
          className={`grid gap-4 ${isWorkspaceMode ? "xl:grid-cols-1" : "xl:grid-cols-[minmax(0,1fr)_320px]"}`}
        >
          <div className="relative min-w-0">
            {showWorkspaceBanner && (
              <div className="mb-2 flex items-start justify-between gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--accent)]/35 px-3 py-2 text-xs text-[color:var(--text-main)] shadow-sm">
                <div>
                  <p className="font-semibold">Landscape workspace is on</p>
                  <p className="mt-0.5">
                    Rotate your phone sideways for a larger canvas. If the
                    browser does not rotate automatically, the board still stays
                    in a cleaner full-focus layout.
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-2 py-1 font-semibold"
                  onClick={exitWorkspaceMode}
                >
                  Close
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
            <div className="absolute right-2 top-12 flex flex-wrap gap-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)]/95 p-1 shadow-sm sm:right-3 sm:top-3">
              {REACTIONS.map(({ emoji, label, Icon }) => (
                <button
                  key={emoji}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-transparent text-[color:var(--primary)] transition hover:border-[color:var(--border)] hover:bg-[color:var(--surface-soft)] sm:h-10 sm:w-10"
                  onClick={() => sendReaction(emoji)}
                  aria-label={label}
                  title={label}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>

          {(!showMobileLayout || (!isWorkspaceMode && mobileInfoOpen)) && (
            <div className="space-y-4">
              <ParticipantsPanel participants={participants} userId={userId} />
              <Card className="space-y-3 p-4 bg-[color:var(--surface)]">
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
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    value={chatDraft}
                    onChange={(e) => setChatDraft(e.target.value.slice(0, 240))}
                    onKeyDown={(e) => e.key === "Enter" && sendChat()}
                    className="flex-1 rounded-2xl border-2 border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2.5 text-sm outline-none ring-0 transition focus:border-[color:var(--primary)] focus:shadow-[0_0_0_3px_rgba(47,35,69,0.16)]"
                    placeholder={
                      mode === "guess-mode"
                        ? "Guess the drawing..."
                        : "Send a message"
                    }
                  />
                  <Button onClick={sendChat} className="min-h-10">
                    Send
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </section>
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
        description="Are you sure you want to leave this Art Colab room?"
        confirmLabel="Leave"
        cancelLabel="Cancel"
        destructive
        onCancel={() => setIsExitModalOpen(false)}
        onConfirm={() => {
          leaveSocketRoom();
          setIsExitModalOpen(false);
          router.push("/");
        }}
      />
      <ToastStack toasts={toasts} />
    </main>
  );
}
