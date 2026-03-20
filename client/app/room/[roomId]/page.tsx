"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Brush,
  Download,
  Eraser,
  Link2,
  MessageSquare,
  PaintBucket,
  PencilRuler,
  Redo2,
  RefreshCw,
  Shapes,
  Trash2,
  Undo2,
  Users,
  X,
  LogOut,
  Square,
  Circle,
  Triangle,
  Star,
  Slash,
  Sparkles,
} from "lucide-react";
import { nanoid } from "nanoid";
import { SOCKET_EVENTS } from "@cloudcanvas/shared";
import type { BrushStyle, DrawingTool, ShapeKind } from "@cloudcanvas/shared";
import { CanvasBoard } from "@/components/canvas-board";
import { ConfirmModal } from "@/components/confirm-modal";
import { ParticipantsPanel } from "@/components/participants-panel";
import { ToastStack, type ToastMessage } from "@/components/toast";
import {
  Badge,
  Button,
  Card,
  DangerButton,
  SecondaryButton,
} from "@/components/ui";
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

const BRUSH_OPTIONS: Array<{ id: BrushStyle; label: string }> = [
  { id: "classic", label: "Classic" },
  { id: "crayon", label: "Crayon" },
  { id: "neon", label: "Neon" },
  { id: "spray", label: "Spray" },
  { id: "dotted", label: "Dotted" },
];

const SHAPE_OPTIONS: Array<{ tool: ShapeKind; label: string; icon: typeof Square }> = [
  { tool: "line", label: "Line", icon: Slash },
  { tool: "rectangle", label: "Rectangle", icon: Square },
  { tool: "square", label: "Square", icon: Square },
  { tool: "circle", label: "Circle", icon: Circle },
  { tool: "ellipse", label: "Ellipse", icon: Circle },
  { tool: "triangle", label: "Triangle", icon: Triangle },
  { tool: "star", label: "Star", icon: Star },
];

const PRESET_COLORS = [
  "#111111",
  "#ffd84d",
  "#1c7dd7",
  "#ff5d5d",
  "#1fb76a",
  "#fb923c",
  "#ec4899",
  "#fff7df",
];

type ToolPanel = "brush" | "eraser" | "fill" | "shapes" | "reactions" | null;
type FunctionPanel = "chat" | null;

const sidebarShell =
  "rounded-[28px] border border-[color:var(--border)]/10 bg-white/80 p-2 shadow-[0_18px_50px_rgba(26,26,26,0.12)] backdrop-blur";
const railButtonBase =
  "group flex h-12 w-12 items-center justify-center rounded-2xl border border-[color:var(--border)]/10 bg-white text-[color:var(--text-main)] shadow-[0_6px_18px_rgba(26,26,26,0.08)] transition hover:-translate-y-0.5 hover:bg-[color:var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-40";
const panelCard =
  "rounded-[24px] border border-[color:var(--border)]/10 bg-white/95 p-4 shadow-[0_20px_40px_rgba(26,26,26,0.12)] backdrop-blur";
const controlLabel =
  "text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]";

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
  const [resetViewSignal, setResetViewSignal] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [isWorkspaceMode, setIsWorkspaceMode] = useState(false);
  const [activeToolPanel, setActiveToolPanel] = useState<ToolPanel>("brush");
  const [activeFunctionPanel, setActiveFunctionPanel] = useState<FunctionPanel>(null);
  const [showParticipants, setShowParticipants] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const joinedToastShownRef = useRef(false);
  const isMountedRef = useRef(true);
  const colorInputRef = useRef<HTMLInputElement | null>(null);
  const fillColorInputRef = useRef<HTMLInputElement | null>(null);
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
      if (typeof screenOrientation.unlock === "function") screenOrientation.unlock();
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
  const showMobileWorkspace = isMobile || isWorkspaceMode;
  const isShapeTool = SHAPE_OPTIONS.some((shape) => shape.tool === tool);

  useEffect(() => {
    if (tool === "pen") setActiveToolPanel("brush");
    else if (tool === "eraser") setActiveToolPanel("eraser");
    else if (tool === "fill") setActiveToolPanel("fill");
    else if (isShapeTool) setActiveToolPanel("shapes");
  }, [isShapeTool, tool]);

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

  const copyImage = async () => {
    const canvas = document.querySelector("canvas") as HTMLCanvasElement | null;
    if (!canvas || !navigator.clipboard?.write) return;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve));
    if (!blob) return;
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    pushToast("Image copied to clipboard.");
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
      return [...prev, { id, emoji, left: Math.floor(Math.random() * 80) + 10 }];
    });
    window.setTimeout(
      () => setReactionBursts((prev) => prev.filter((burst) => burst.id !== id)),
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
    const onReaction = ({ emoji, reactionId }: { emoji: string; reactionId: string }) => {
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
    const onParticipantJoined = ({ participant }: { participant: { displayName: string } }) =>
      pushToast(`${participant.displayName} joined the room.`);
    const onParticipantLeft = ({ participant }: { participant: { displayName: string } }) =>
      pushToast(`${participant.displayName} left the room.`);
    getSocket().on(SOCKET_EVENTS.ROOM_PARTICIPANT_JOINED, onParticipantJoined);
    getSocket().on(SOCKET_EVENTS.ROOM_PARTICIPANT_LEFT, onParticipantLeft);
    return () => {
      getSocket().off(SOCKET_EVENTS.ROOM_PARTICIPANT_JOINED, onParticipantJoined);
      getSocket().off(SOCKET_EVENTS.ROOM_PARTICIPANT_LEFT, onParticipantLeft);
    };
  }, [pushToast]);

  const enterWorkspaceMode = async () => {
    setIsWorkspaceMode(true);

    try {
      if (document.fullscreenElement == null) await document.documentElement.requestFullscreen();
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
    revokeRoomAccess(roomId);
    setIsExitModalOpen(false);
    router.push("/");
  }, [leaveSocketRoom, resetWorkspaceMode, roomId, router]);

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
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to unlock room.";
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
              Enter the password for {roomMeta.name || `room ${roomMeta.roomId}`} to start the live session.
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
          {privateRoomError && <p className="text-sm text-red-600">{privateRoomError}</p>}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="flex-1" onClick={() => void unlockPrivateRoom()} disabled={isUnlockingPrivateRoom}>
              {isUnlockingPrivateRoom ? "Unlocking..." : "Unlock room"}
            </Button>
            <SecondaryButton className="flex-1" onClick={() => router.push("/")}>
              Back home
            </SecondaryButton>
          </div>
        </Card>
      </main>
    );

  const roomTitle = roomMeta?.name || `Room ${roomId}`;

  return (
    <main className={`relative overflow-hidden ${isWorkspaceMode ? "min-h-dvh" : "min-h-screen"}`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,#ffffff_0%,rgba(255,255,255,0.75)_22%,rgba(248,244,232,0)_60%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-[1800px] flex-col px-3 py-3 sm:px-5 sm:py-5 lg:px-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[color:var(--text-muted)] sm:text-xs">
              Collaborative workspace
            </p>
            <h1 className="truncate text-lg font-black text-[color:var(--text-main)] sm:text-2xl">
              {roomTitle}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="hidden sm:inline-flex border-[color:var(--border)]/15 bg-white/80">
              {roomMeta?.visibility ?? "public"}
            </Badge>
            <UserAvatarMenu />
          </div>
        </div>

        {error && <div className="status-banner status-danger mb-3">{error}</div>}
        {status !== "connected" && (
          <div className={`status-banner mb-3 ${status === "reconnecting" || status === "disconnected" ? "status-danger" : ""}`}>
            {status === "connecting" && "Connecting to the collaboration server…"}
            {status === "reconnecting" && "Realtime connection dropped. Trying to reconnect…"}
            {status === "disconnected" && "Realtime connection is offline right now. We’ll reconnect automatically when possible."}
          </div>
        )}

        <section className={`relative flex-1 overflow-hidden rounded-[34px] border border-white/70 bg-[linear-gradient(145deg,rgba(17,24,39,0.04),rgba(255,255,255,0.82))] p-2 shadow-[0_30px_80px_rgba(26,26,26,0.18)] ${showMobileWorkspace ? "min-h-[calc(100dvh-7.5rem)]" : "min-h-[calc(100vh-9rem)]"}`}>
          <div className={`flex h-full flex-col overflow-hidden rounded-[28px] border border-[color:var(--border)]/10 bg-[rgba(246,248,251,0.88)] p-2 sm:p-3 ${showMobileWorkspace ? "" : ""}`}>
            <div className="mb-2 flex items-center gap-2 overflow-x-auto rounded-[22px] border border-[color:var(--border)]/10 bg-white/80 px-3 py-2 backdrop-blur">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-[color:var(--text-main)]">{roomTitle}</p>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[color:var(--text-muted)]">
                  <span>{roomId}</span>
                  <span className="h-1 w-1 rounded-full bg-[color:var(--text-muted)]/50" />
                  <span className="capitalize">{roomMeta?.visibility ?? "public"}</span>
                  {mode === "guess-mode" && (
                    <>
                      <span className="h-1 w-1 rounded-full bg-[color:var(--text-muted)]/50" />
                      <span>Guess mode</span>
                    </>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="inline-flex h-10 items-center gap-2 rounded-2xl border border-[color:var(--border)]/10 bg-[color:var(--surface-soft)] px-3 text-sm font-semibold text-[color:var(--text-main)] shadow-sm transition hover:bg-[color:var(--accent)]/70"
                onClick={() => setShowParticipants((value) => !value)}
              >
                <Users size={16} />
                <span>{participants.length}</span>
              </button>
              <SecondaryButton
                className="h-10 min-h-0 rounded-2xl border-[color:var(--border)]/10 bg-white px-3 py-0 text-xs shadow-sm"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  pushToast("Room link copied.");
                }}
              >
                <Link2 size={15} />
                Copy link
              </SecondaryButton>
            </div>

            <div className={`relative flex-1 overflow-hidden ${showMobileWorkspace ? "overflow-x-auto" : ""}`}>
              <div className={`grid h-full min-h-0 gap-3 ${showMobileWorkspace ? "min-w-[980px] grid-cols-[72px_minmax(560px,1fr)_72px]" : "grid-cols-[88px_minmax(0,1fr)_88px] xl:grid-cols-[320px_minmax(0,1fr)_320px]"}`}>
                <aside className="relative z-20 min-h-0">
                  <div className={`flex h-full ${showMobileWorkspace ? "flex-col items-center" : "xl:grid xl:grid-cols-[72px_minmax(0,1fr)] xl:gap-3"}`}>
                    <div className={`${sidebarShell} ${showMobileWorkspace ? "flex flex-col items-center gap-2" : "flex flex-col items-center gap-2 xl:sticky xl:top-0 xl:h-fit"}`}>
                      <button type="button" className={railButtonBase} onClick={() => getSocket().emit(SOCKET_EVENTS.STROKE_UNDO, { roomId, userId })} disabled={!hasJoined || !canUndo} aria-label="Undo">
                        <Undo2 size={18} />
                      </button>
                      <button type="button" className={railButtonBase} onClick={() => getSocket().emit(SOCKET_EVENTS.STROKE_REDO, { roomId, userId })} disabled={!hasJoined || !canRedo} aria-label="Redo">
                        <Redo2 size={18} />
                      </button>
                      <button type="button" className={railButtonBase} onClick={download} disabled={!hasJoined} aria-label="Export board">
                        <Download size={18} />
                      </button>
                      <button type="button" className={railButtonBase} onClick={() => setIsClearModalOpen(true)} disabled={!hasJoined} aria-label="Clear board">
                        <Trash2 size={18} />
                      </button>
                      <button type="button" className={railButtonBase} onClick={() => {navigator.clipboard.writeText(window.location.href); pushToast("Room link copied.");}} aria-label="Copy room link">
                        <Link2 size={18} />
                      </button>
                      <button
                        type="button"
                        className={`${railButtonBase} ${activeFunctionPanel === "chat" ? "bg-[color:var(--brand-blue)] text-white" : ""}`}
                        onClick={() => setActiveFunctionPanel((value) => (value === "chat" ? null : "chat"))}
                        aria-label="Open chat"
                      >
                        <MessageSquare size={18} />
                      </button>
                      <button type="button" className={`${railButtonBase} text-[color:var(--brand-red)]`} onClick={() => setIsExitModalOpen(true)} aria-label="Leave room">
                        <LogOut size={18} />
                      </button>
                    </div>

                    <div className={`min-h-0 flex-1 ${showMobileWorkspace ? "hidden" : "hidden xl:block"}`}>
                      {activeFunctionPanel === "chat" ? (
                        <div className={`${panelCard} flex h-full min-h-0 flex-col`}>
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <div>
                              <p className={controlLabel}>Room chat</p>
                              <h2 className="mt-1 text-lg font-black text-[color:var(--text-main)]">Discuss the sketch</h2>
                            </div>
                            <button type="button" className="rounded-full p-1 text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-soft)]" onClick={() => setActiveFunctionPanel(null)}>
                              <X size={16} />
                            </button>
                          </div>
                          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-[20px] border border-[color:var(--border)]/10 bg-[color:var(--bg-elevated)] p-3 text-sm">
                            {chatMessages.length === 0 ? (
                              <p className="text-xs text-[color:var(--text-muted)]">No messages yet. Introduce the sketch or share feedback.</p>
                            ) : (
                              chatMessages.map((message) => (
                                <div key={message.messageId} className="rounded-2xl bg-white px-3 py-2 shadow-sm">
                                  <p className="text-xs font-semibold text-[color:var(--text-muted)]">{message.displayName}</p>
                                  <p className="mt-1 text-sm text-[color:var(--text-main)]">{message.text}</p>
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
                              className="w-full rounded-2xl border border-[color:var(--border)]/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-[color:var(--brand-blue)]"
                              placeholder={mode === "guess-mode" ? "Guess the drawing..." : "Send a message"}
                            />
                            <Button onClick={sendChat} className="min-h-10 rounded-2xl text-sm">Send</Button>
                          </div>
                        </div>
                      ) : (
                        <div className={`${panelCard} flex h-full flex-col justify-between bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(238,248,216,0.76))]`}>
                          <div>
                            <p className={controlLabel}>Session tools</p>
                            <h2 className="mt-1 text-lg font-black">Keep the room flowing</h2>
                            <p className="mt-2 text-sm text-[color:var(--text-muted)]">Undo, redo, export, chat, and room sharing now live in a dedicated session rail so the board stays uncluttered.</p>
                          </div>
                          <div className="mt-4 space-y-2 text-xs text-[color:var(--text-muted)]">
                            <p>• Chat opens in this left workspace zone without covering the canvas.</p>
                            <p>• Destructive actions still use confirmation modals.</p>
                            <p>• Core room sync, save/load, auth, and access logic remain unchanged.</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </aside>

                <section className="relative min-h-0">
                  <div className="relative flex h-full min-h-0 flex-col">
                    {showParticipants && (
                      <div className="absolute left-0 top-0 z-30 w-full max-w-sm">
                        <div className={`${panelCard} p-3`}>
                          <div className="mb-2 flex items-center justify-between gap-3 px-1">
                            <div>
                              <p className={controlLabel}>Live room</p>
                              <p className="text-sm font-black text-[color:var(--text-main)]">Participants</p>
                            </div>
                            <button type="button" className="rounded-full p-1 text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-soft)]" onClick={() => setShowParticipants(false)}>
                              <X size={16} />
                            </button>
                          </div>
                          <ParticipantsPanel participants={participants} userId={userId} compact />
                        </div>
                      </div>
                    )}
                    <div className="relative flex-1 min-h-0 rounded-[28px] border border-[color:var(--border)]/10 bg-[linear-gradient(160deg,#d9efff_0%,#eef9ff_45%,#f6fafc_100%)] p-2 sm:p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
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
                        compact={showMobileWorkspace}
                      />
                      {strokes.length === 0 && (
                        <div className="pointer-events-none absolute inset-0 grid place-items-center p-4 sm:p-8">
                          <div className="max-w-sm rounded-[24px] border border-[color:var(--border)]/10 bg-white/90 px-5 py-4 text-center shadow-[0_18px_40px_rgba(26,26,26,0.14)] backdrop-blur">
                            <p className="text-sm font-semibold text-[color:var(--text-main)]">Board-first collaborative drawing</p>
                            <p className="mt-1 text-xs text-[color:var(--text-muted)]">Use the right rail for drawing tools, the left rail for room actions, and keep the board as the center of attention.</p>
                          </div>
                        </div>
                      )}
                      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[28px]">
                        {reactionBursts.map((burst) => (
                          <div key={burst.id} className="absolute bottom-4 text-2xl animate-[float-up_2.2s_ease-out_forwards] sm:bottom-6 sm:text-3xl" style={{ left: `${burst.left}%` }}>
                            {burst.emoji}
                          </div>
                        ))}
                      </div>
                    </div>

                    {showMobileWorkspace && activeFunctionPanel === "chat" && (
                      <div className="mt-3 xl:hidden">
                        <div className={`${panelCard} flex flex-col`}>
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <div>
                              <p className={controlLabel}>Room chat</p>
                              <h2 className="mt-1 text-base font-black text-[color:var(--text-main)]">Discuss the sketch</h2>
                            </div>
                            <button type="button" className="rounded-full p-1 text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-soft)]" onClick={() => setActiveFunctionPanel(null)}>
                              <X size={16} />
                            </button>
                          </div>
                          <div className="max-h-48 space-y-2 overflow-y-auto rounded-[20px] border border-[color:var(--border)]/10 bg-[color:var(--bg-elevated)] p-3 text-sm">
                            {chatMessages.length === 0 ? (
                              <p className="text-xs text-[color:var(--text-muted)]">No messages yet. Introduce the sketch or share feedback.</p>
                            ) : (
                              chatMessages.map((message) => (
                                <div key={message.messageId} className="rounded-2xl bg-white px-3 py-2 shadow-sm">
                                  <p className="text-xs font-semibold text-[color:var(--text-muted)]">{message.displayName}</p>
                                  <p className="mt-1 text-sm text-[color:var(--text-main)]">{message.text}</p>
                                </div>
                              ))
                            )}
                            <div ref={chatEndRef} />
                          </div>
                          <div className="mt-3 flex gap-2">
                            <input
                              value={chatDraft}
                              onChange={(e) => setChatDraft(e.target.value.slice(0, 240))}
                              onKeyDown={(e) => e.key === "Enter" && sendChat()}
                              className="w-full rounded-2xl border border-[color:var(--border)]/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-[color:var(--brand-blue)]"
                              placeholder={mode === "guess-mode" ? "Guess the drawing..." : "Send a message"}
                            />
                            <Button onClick={sendChat} className="min-h-10 rounded-2xl px-4 text-sm">Send</Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </section>

                <aside className="relative z-20 min-h-0">
                  <div className={`flex h-full ${showMobileWorkspace ? "flex-col items-center" : "xl:grid xl:grid-cols-[minmax(0,1fr)_72px] xl:gap-3"}`}>
                    <div className={`min-h-0 flex-1 ${showMobileWorkspace ? "hidden" : "hidden xl:block"}`}>
                      <div className={`${panelCard} h-full min-h-0 overflow-y-auto`}>
                        <div className="mb-4 flex items-start justify-between gap-3">
                          <div>
                            <p className={controlLabel}>Drawing tools</p>
                            <h2 className="mt-1 text-lg font-black text-[color:var(--text-main)]">
                              {activeToolPanel === "brush" && "Brush settings"}
                              {activeToolPanel === "eraser" && "Eraser settings"}
                              {activeToolPanel === "fill" && "Fill settings"}
                              {activeToolPanel === "shapes" && "Shape settings"}
                              {activeToolPanel === "reactions" && "Quick reactions"}
                            </h2>
                          </div>
                          {activeToolPanel && (
                            <button type="button" className="rounded-full p-1 text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-soft)]" onClick={() => setActiveToolPanel(null)}>
                              <X size={16} />
                            </button>
                          )}
                        </div>

                        {activeToolPanel === "brush" && (
                          <div className="space-y-4">
                            <div>
                              <p className={controlLabel}>Brush style</p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {BRUSH_OPTIONS.map((option) => (
                                  <button key={option.id} type="button" className={`rounded-2xl border px-3 py-2 text-sm font-semibold transition ${brushStyle === option.id ? "border-transparent bg-[color:var(--brand-blue)] text-white" : "border-[color:var(--border)]/10 bg-[color:var(--bg-elevated)] hover:bg-[color:var(--surface-soft)]"}`} onClick={() => {setTool("pen"); setBrushStyle(option.id);}}>
                                    {option.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <div className="flex items-center justify-between gap-3">
                                <p className={controlLabel}>Thickness</p>
                                <span className="rounded-full bg-[color:var(--surface-soft)] px-2 py-1 text-xs font-bold">{size}px</span>
                              </div>
                              <input type="range" min={1} max={24} value={size} onChange={(e) => setSize(Number(e.target.value))} className="mt-2 w-full accent-[color:var(--brand-blue)]" />
                            </div>
                            <div>
                              <div className="flex items-center justify-between gap-3">
                                <p className={controlLabel}>Stroke color</p>
                                <button type="button" className="h-9 w-9 rounded-full border border-[color:var(--border)]/10" style={{ backgroundColor: strokeColor }} onClick={() => colorInputRef.current?.click()} />
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {PRESET_COLORS.map((color) => (
                                  <button key={color} type="button" className={`h-9 w-9 rounded-full border-2 ${strokeColor.toLowerCase() === color.toLowerCase() ? "border-[color:var(--text-main)]" : "border-transparent"}`} style={{ backgroundColor: color }} onClick={() => updateStrokeColor(color)} />
                                ))}
                                <input ref={colorInputRef} type="color" value={strokeColor} onChange={(e) => updateStrokeColor(e.target.value)} className="sr-only" />
                              </div>
                            </div>
                          </div>
                        )}

                        {activeToolPanel === "eraser" && (
                          <div className="space-y-4">
                            <div>
                              <div className="flex items-center justify-between gap-3">
                                <p className={controlLabel}>Eraser size</p>
                                <span className="rounded-full bg-[color:var(--surface-soft)] px-2 py-1 text-xs font-bold">{size}px</span>
                              </div>
                              <input type="range" min={4} max={32} value={size} onChange={(e) => setSize(Number(e.target.value))} className="mt-2 w-full accent-[color:var(--brand-blue)]" />
                            </div>
                            <div className="rounded-[20px] bg-[color:var(--bg-elevated)] p-3 text-sm text-[color:var(--text-muted)]">
                              The eraser keeps the same precise coordinate mapping and clears with the existing realtime stroke logic.
                            </div>
                          </div>
                        )}

                        {activeToolPanel === "fill" && (
                          <div className="space-y-4">
                            <div>
                              <div className="flex items-center justify-between gap-3">
                                <p className={controlLabel}>Fill color</p>
                                <button type="button" className="h-9 w-9 rounded-full border border-[color:var(--border)]/10" style={{ backgroundColor: fillColor }} onClick={() => fillColorInputRef.current?.click()} />
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {PRESET_COLORS.map((color) => (
                                  <button key={color} type="button" className={`h-9 w-9 rounded-full border-2 ${fillColor.toLowerCase() === color.toLowerCase() ? "border-[color:var(--text-main)]" : "border-transparent"}`} style={{ backgroundColor: color }} onClick={() => updateFillColor(color)} />
                                ))}
                                <input ref={fillColorInputRef} type="color" value={fillColor} onChange={(e) => updateFillColor(e.target.value)} className="sr-only" />
                              </div>
                            </div>
                            <div className="rounded-[20px] bg-[color:var(--bg-elevated)] p-3 text-sm text-[color:var(--text-muted)]">
                              Flood fill stays intentionally simple so the interaction remains fast and clean.
                            </div>
                          </div>
                        )}

                        {activeToolPanel === "shapes" && (
                          <div className="space-y-4">
                            <div>
                              <p className={controlLabel}>Choose a shape</p>
                              <div className="mt-2 grid grid-cols-2 gap-2">
                                {SHAPE_OPTIONS.map(({ tool: shapeTool, label, icon: Icon }) => (
                                  <button key={shapeTool} type="button" className={`flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold transition ${tool === shapeTool ? "border-transparent bg-[color:var(--brand-blue)] text-white" : "border-[color:var(--border)]/10 bg-[color:var(--bg-elevated)] hover:bg-[color:var(--surface-soft)]"}`} onClick={() => setTool(shapeTool)}>
                                    <Icon size={15} />
                                    <span>{label}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <p className={controlLabel}>Stroke color</p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {PRESET_COLORS.map((color) => (
                                  <button key={color} type="button" className={`h-8 w-8 rounded-full border-2 ${strokeColor.toLowerCase() === color.toLowerCase() ? "border-[color:var(--text-main)]" : "border-transparent"}`} style={{ backgroundColor: color }} onClick={() => updateStrokeColor(color)} />
                                ))}
                              </div>
                            </div>
                            <label className="flex items-center justify-between gap-3 rounded-[20px] bg-[color:var(--bg-elevated)] px-3 py-3 text-sm text-[color:var(--text-main)]">
                              <div>
                                <p className="font-semibold">Fill closed shapes</p>
                                <p className="text-xs text-[color:var(--text-muted)]">Use the selected fill color for rectangles, circles, triangles, and stars.</p>
                              </div>
                              <input type="checkbox" checked={fillEnabled} onChange={(e) => setFillEnabled(e.target.checked)} className="h-4 w-4" />
                            </label>
                          </div>
                        )}

                        {activeToolPanel === "reactions" && (
                          <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 xl:grid-cols-3">
                              {REACTIONS.map(({ emoji, label }) => (
                                <button key={emoji} type="button" className="flex aspect-square items-center justify-center rounded-2xl border border-[color:var(--border)]/10 bg-[color:var(--bg-elevated)] text-2xl transition hover:-translate-y-0.5 hover:bg-[color:var(--surface-soft)]" onClick={() => sendReaction(emoji)} title={label} aria-label={label}>
                                  {emoji}
                                </button>
                              ))}
                            </div>
                            <p className="text-sm text-[color:var(--text-muted)]">Reaction bursts reuse the existing realtime event pipeline and are deduplicated before animating over the board.</p>
                          </div>
                        )}

                        {!activeToolPanel && (
                          <div className="rounded-[20px] bg-[color:var(--bg-elevated)] p-4 text-sm text-[color:var(--text-muted)]">
                            Select a tool from the right rail to open its compact options panel.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className={`${sidebarShell} ${showMobileWorkspace ? "flex flex-col items-center gap-2" : "flex flex-col items-center gap-2 xl:sticky xl:top-0 xl:order-2 xl:h-fit"}`}>
                      <button type="button" className={`${railButtonBase} ${activeToolPanel === "brush" ? "bg-[color:var(--brand-blue)] text-white" : ""}`} onClick={() => {setTool("pen"); setActiveToolPanel("brush");}} aria-label="Brush tool">
                        <Brush size={18} />
                      </button>
                      <button type="button" className={`${railButtonBase} ${activeToolPanel === "eraser" ? "bg-[color:var(--brand-blue)] text-white" : ""}`} onClick={() => {setTool("eraser"); setActiveToolPanel("eraser");}} aria-label="Eraser tool">
                        <Eraser size={18} />
                      </button>
                      <button type="button" className={`${railButtonBase} ${activeToolPanel === "fill" ? "bg-[color:var(--brand-blue)] text-white" : ""}`} onClick={() => {setTool("fill"); setFillEnabled(true); setActiveToolPanel("fill");}} aria-label="Fill tool">
                        <PaintBucket size={18} />
                      </button>
                      <button type="button" className={`${railButtonBase} ${activeToolPanel === "shapes" ? "bg-[color:var(--brand-blue)] text-white" : ""}`} onClick={() => {if (!isShapeTool) setTool("rectangle"); setActiveToolPanel("shapes");}} aria-label="Shapes tool">
                        <Shapes size={18} />
                      </button>
                      <button type="button" className={`${railButtonBase} ${activeToolPanel === "reactions" ? "bg-[color:var(--brand-blue)] text-white" : ""}`} onClick={() => setActiveToolPanel((value) => (value === "reactions" ? null : "reactions"))} aria-label="Reactions">
                        <Sparkles size={18} />
                      </button>
                      <button type="button" className={railButtonBase} onClick={() => setResetViewSignal((value) => value + 1)} aria-label="Reset view">
                        <PencilRuler size={18} />
                      </button>
                    </div>
                  </div>
                </aside>
              </div>
            </div>

            {showMobileWorkspace && activeToolPanel && (
              <div className="mt-3 xl:hidden">
                <div className={`${panelCard}`}>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className={controlLabel}>Quick tool panel</p>
                      <h2 className="mt-1 text-base font-black text-[color:var(--text-main)]">{activeToolPanel === "brush" ? "Brush" : activeToolPanel === "eraser" ? "Eraser" : activeToolPanel === "fill" ? "Fill" : activeToolPanel === "shapes" ? "Shapes" : "Reactions"}</h2>
                    </div>
                    <button type="button" className="rounded-full p-1 text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-soft)]" onClick={() => setActiveToolPanel(null)}>
                      <X size={16} />
                    </button>
                  </div>
                  <div className="text-sm text-[color:var(--text-muted)]">
                    {activeToolPanel === "reactions" ? (
                      <div className="grid grid-cols-5 gap-2">
                        {REACTIONS.map(({ emoji, label }) => (
                          <button key={emoji} type="button" className="flex h-12 items-center justify-center rounded-2xl border border-[color:var(--border)]/10 bg-[color:var(--bg-elevated)] text-2xl" onClick={() => sendReaction(emoji)} aria-label={label}>
                            {emoji}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p>Use the landscape-style rails to keep tools accessible while preserving maximum board space across small screens.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      <SecondaryButton className="fixed bottom-4 right-4 z-[70] min-h-12 rounded-full px-4 text-sm sm:bottom-6 sm:right-6" onClick={isWorkspaceMode ? exitWorkspaceMode : enterWorkspaceMode}>
        <RefreshCw size={16} /> {isWorkspaceMode ? "Normal view" : "Rotate view"}
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
