"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Brush,
  Download,
  Eraser,
  Info,
  Link2,
  LogOut,
  MessageSquare,
  PaintBucket,
  Redo2,
  Shapes,
  Trash2,
  Undo2,
  Square,
  Circle,
  Triangle,
  Star,
  Slash,
  Sparkles,
  Lock,
  Globe,
  Users,
  X,
} from "lucide-react";
import { nanoid } from "nanoid";
import { SOCKET_EVENTS } from "@cloudcanvas/shared";
import type { BrushStyle, DrawingTool, ShapeKind } from "@cloudcanvas/shared";
import { CanvasBoard } from "@/components/canvas-board";
import { ConfirmModal } from "@/components/confirm-modal";
import { ToastStack, type ToastMessage } from "@/components/toast";
import { Button, Card, SecondaryButton } from "@/components/ui";
import { getSocket } from "@/lib/socket";
import { useRoomSocket } from "@/hooks/use-room-socket";
import { getRoom, joinRoom } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import {
  grantRoomAccess,
  hasRoomAccessGrant,
  revokeRoomAccess,
} from "@/lib/room-access";
import { getAvatarInitials, resolveSessionDisplayName } from "@/lib/guest";

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

const SHAPE_OPTIONS: Array<{
  tool: ShapeKind;
  label: string;
  icon: typeof Square;
}> = [
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

type ToolPanel = "brush" | "eraser" | "fill" | "shapes" | "reactions" | "info" | null;
type FunctionPanel = "chat" | null;

const sidebarShell =
  "rounded-[24px] border border-black/5 bg-white/78 p-1.5 shadow-[0_16px_38px_rgba(15,23,42,0.12)] backdrop-blur-xl";
const railButtonBase =
  "group flex h-11 w-11 items-center justify-center rounded-[18px] border border-black/5 bg-white/92 text-[color:var(--text-main)] shadow-[0_6px_16px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:bg-[color:var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-40 sm:h-12 sm:w-12";
const floatingPanelCard =
  "rounded-[20px] border border-black/5 bg-white/95 p-3 shadow-[0_22px_44px_rgba(15,23,42,0.18)] backdrop-blur-xl";
const controlLabel =
  "text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]";
const railBadge =
  "absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[color:var(--brand-blue)] px-1 text-[10px] font-bold text-white shadow-sm";

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
  const [isTouchWorkspace, setIsTouchWorkspace] = useState(false);
  const [landscapeHintNeeded, setLandscapeHintNeeded] = useState(false);
  const [activeToolPanel, setActiveToolPanel] = useState<ToolPanel>("brush");
  const [activeFunctionPanel, setActiveFunctionPanel] =
    useState<FunctionPanel>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const joinedToastShownRef = useRef(false);
  const isMountedRef = useRef(true);
  const colorInputRef = useRef<HTMLInputElement | null>(null);
  const fillColorInputRef = useRef<HTMLInputElement | null>(null);
  const orientationLockedRef = useRef(false);
  const toolPanelRef = useRef<HTMLDivElement | null>(null);
  const functionPanelRef = useRef<HTMLDivElement | null>(null);
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
        )
          setRoomReady(false);
        else setRoomReady(true);
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
      const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
      const compactViewport = window.innerWidth <= 1366;
      setIsTouchWorkspace(coarsePointer && compactViewport);
      setLandscapeHintNeeded(window.innerHeight > window.innerWidth);
    };
    updateViewportState();
    window.addEventListener("resize", updateViewportState);
    window.addEventListener("orientationchange", updateViewportState);
    return () => {
      window.removeEventListener("resize", updateViewportState);
      window.removeEventListener("orientationchange", updateViewportState);
    };
  }, []);

  const resetWorkspaceMode = useCallback(
    async ({ preserveState = false }: { preserveState?: boolean } = {}) => {
      document.body.classList.remove("room-workspace-body");
      document.documentElement.classList.remove("room-workspace-root");
      if (!preserveState && isMountedRef.current) setLandscapeHintNeeded(false);
      const screenOrientation = window.screen
        .orientation as ScreenOrientation & { unlock?: () => void };
      if (
        orientationLockedRef.current &&
        typeof screenOrientation.unlock === "function"
      ) {
        try {
          screenOrientation.unlock();
        } catch {
          // noop
        }
      }
      orientationLockedRef.current = false;
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
    if (!roomReady) {
      void resetWorkspaceMode({ preserveState: true });
      return;
    }
    document.body.classList.add("room-workspace-body");
    document.documentElement.classList.add("room-workspace-root");

    const screenOrientation = window.screen.orientation as ScreenOrientation & {
      lock?: (orientation: string) => Promise<void>;
    };

    const tryLock = async () => {
      if (!isTouchWorkspace || typeof screenOrientation.lock !== "function") {
        setLandscapeHintNeeded(window.innerHeight > window.innerWidth);
        return;
      }
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
        await screenOrientation.lock("landscape");
        orientationLockedRef.current = true;
        setLandscapeHintNeeded(false);
      } catch {
        setLandscapeHintNeeded(window.innerHeight > window.innerWidth);
      }
    };

    void tryLock();
    return () => {
      void resetWorkspaceMode({ preserveState: true });
    };
  }, [isTouchWorkspace, resetWorkspaceMode, roomReady]);

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
    if (!chatEndRef.current || activeFunctionPanel !== "chat") return;
    chatEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [activeFunctionPanel, chatMessages]);

  const canUndo = strokes.some((stroke) => stroke.userId === userId);
  const canRedo = redoCount > 0;
  const isShapeTool = SHAPE_OPTIONS.some((shape) => shape.tool === tool);
  const participantPreview = participants.slice(0, 5);
  const roomTitle = roomMeta?.name || `Room ${roomId}`;
  const connectionMessage =
    error ||
    (status === "connecting" && "Connecting to the collaboration server…") ||
    (status === "reconnecting" &&
      "Realtime connection dropped. Trying to reconnect…") ||
    (status === "disconnected" &&
      "Realtime connection is offline right now. We’ll reconnect automatically when possible.") ||
    null;

  const closeFloatingPanels = useCallback(
    (options: { keep?: "tool" | "function" | null } = {}) => {
      if (options.keep !== "tool") setActiveToolPanel(null);
      if (options.keep !== "function") setActiveFunctionPanel(null);
    },
    [],
  );

  useEffect(() => {
    if (tool === "pen") setActiveToolPanel("brush");
    else if (tool === "eraser") setActiveToolPanel("eraser");
    else if (tool === "fill") setActiveToolPanel("fill");
    else if (isShapeTool) setActiveToolPanel("shapes");
  }, [isShapeTool, tool]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (toolPanelRef.current?.contains(target)) return;
      if (functionPanelRef.current?.contains(target)) return;
      closeFloatingPanels();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [closeFloatingPanels]);

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
    closeFloatingPanels();
    await resetWorkspaceMode();
    leaveSocketRoom();
    revokeRoomAccess(roomId);
    setIsExitModalOpen(false);
    router.push("/");
  }, [closeFloatingPanels, leaveSocketRoom, resetWorkspaceMode, roomId, router]);

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
      const message =
        error instanceof Error ? error.message : "Unable to unlock room.";
      setPrivateRoomError(message);
    } finally {
      setIsUnlockingPrivateRoom(false);
    }
  }, [privateRoomPassword, pushToast, roomMeta]);

  const openToolPanel = (panel: Exclude<ToolPanel, null>) => {
    setActiveFunctionPanel(null);
    setActiveToolPanel((current) => (current === panel ? null : panel));
  };

  const renderToolPanelContent = () => {
    if (activeToolPanel === "brush") return (
      <div className="space-y-4">
        <div>
          <p className={controlLabel}>Brush style</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {BRUSH_OPTIONS.map((option) => (
              <button key={option.id} type="button" className={`rounded-2xl border px-3 py-2 text-sm font-semibold transition ${brushStyle === option.id ? "border-transparent bg-[color:var(--brand-blue)] text-white" : "border-black/5 bg-[color:var(--bg-elevated)] hover:bg-[color:var(--surface-soft)]"}`} onClick={() => { setTool("pen"); setBrushStyle(option.id); }}>
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
            <button type="button" className="h-9 w-9 rounded-full border border-black/10" style={{ backgroundColor: strokeColor }} onClick={() => colorInputRef.current?.click()} />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {[...recentColors, ...PRESET_COLORS.filter((color) => !recentColors.includes(color))].slice(0, 8).map((color) => (
              <button key={color} type="button" className={`h-9 w-9 rounded-full border-2 ${strokeColor.toLowerCase() === color.toLowerCase() ? "border-[color:var(--text-main)]" : "border-transparent"}`} style={{ backgroundColor: color }} onClick={() => updateStrokeColor(color)} />
            ))}
            <input ref={colorInputRef} type="color" value={strokeColor} onChange={(e) => updateStrokeColor(e.target.value)} className="sr-only" />
          </div>
        </div>
      </div>
    );
    if (activeToolPanel === "eraser") return (
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between gap-3">
            <p className={controlLabel}>Eraser size</p>
            <span className="rounded-full bg-[color:var(--surface-soft)] px-2 py-1 text-xs font-bold">{size}px</span>
          </div>
          <input type="range" min={4} max={32} value={size} onChange={(e) => setSize(Number(e.target.value))} className="mt-2 w-full accent-[color:var(--brand-blue)]" />
        </div>
        <div className="rounded-[18px] bg-[color:var(--bg-elevated)] p-3 text-sm text-[color:var(--text-muted)]">Eraser strokes now stay on the same lightweight draw path as brush strokes for lower input latency.</div>
      </div>
    );
    if (activeToolPanel === "fill") return (
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between gap-3">
            <p className={controlLabel}>Fill color</p>
            <button type="button" className="h-9 w-9 rounded-full border border-black/10" style={{ backgroundColor: fillColor }} onClick={() => fillColorInputRef.current?.click()} />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {[...recentColors, ...PRESET_COLORS.filter((color) => !recentColors.includes(color))].slice(0, 8).map((color) => (
              <button key={color} type="button" className={`h-9 w-9 rounded-full border-2 ${fillColor.toLowerCase() === color.toLowerCase() ? "border-[color:var(--text-main)]" : "border-transparent"}`} style={{ backgroundColor: color }} onClick={() => updateFillColor(color)} />
            ))}
            <input ref={fillColorInputRef} type="color" value={fillColor} onChange={(e) => updateFillColor(e.target.value)} className="sr-only" />
          </div>
        </div>
      </div>
    );
    if (activeToolPanel === "shapes") return (
      <div className="space-y-4">
        <div>
          <p className={controlLabel}>Choose a shape</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {SHAPE_OPTIONS.map(({ tool: shapeTool, label, icon: Icon }) => (
              <button key={shapeTool} type="button" className={`flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold transition ${tool === shapeTool ? "border-transparent bg-[color:var(--brand-blue)] text-white" : "border-black/5 bg-[color:var(--bg-elevated)] hover:bg-[color:var(--surface-soft)]"}`} onClick={() => setTool(shapeTool)}>
                <Icon size={15} /> <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center justify-between gap-3 rounded-[18px] bg-[color:var(--bg-elevated)] px-3 py-3 text-sm text-[color:var(--text-main)]">
          <div>
            <p className="font-semibold">Fill closed shapes</p>
            <p className="text-xs text-[color:var(--text-muted)]">Use the selected fill color for supported shapes.</p>
          </div>
          <input type="checkbox" checked={fillEnabled} onChange={(e) => setFillEnabled(e.target.checked)} className="h-4 w-4" />
        </label>
      </div>
    );
    if (activeToolPanel === "reactions") return (
      <div className="space-y-4">
        <div className="grid grid-cols-5 gap-2">
          {REACTIONS.map(({ emoji, label }) => (
            <button key={emoji} type="button" className="flex aspect-square items-center justify-center rounded-2xl border border-black/5 bg-[color:var(--bg-elevated)] text-2xl transition hover:-translate-y-0.5 hover:bg-[color:var(--surface-soft)]" onClick={() => sendReaction(emoji)} title={label} aria-label={label}>{emoji}</button>
          ))}
        </div>
      </div>
    );
    if (activeToolPanel === "info") return (
      <div className="space-y-4">
        <div className="space-y-1">
          <p className="text-sm font-black text-[color:var(--text-main)]">{roomTitle}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--text-muted)]">
            <span className="rounded-full bg-[color:var(--bg-elevated)] px-2 py-1 font-semibold uppercase tracking-[0.14em]">{roomId}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--bg-elevated)] px-2 py-1 font-semibold capitalize">
              {roomMeta?.visibility === "private" ? <Lock size={12} /> : <Globe size={12} />}
              {roomMeta?.visibility ?? "public"}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--bg-elevated)] px-2 py-1 font-semibold"><Users size={12} /> {participants.length}</span>
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className={controlLabel}>Participants</p>
            <button type="button" className="text-xs font-semibold text-[color:var(--brand-blue)]" onClick={() => { navigator.clipboard.writeText(window.location.href); pushToast("Room link copied."); }}>Copy link</button>
          </div>
          <div className="space-y-2">
            {participants.map((participant) => (
              <div key={participant.socketId} className="flex items-center gap-3 rounded-[16px] bg-[color:var(--bg-elevated)] px-3 py-2.5">
                <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-black/5 bg-white text-xs font-semibold text-[color:var(--text-main)]">
                  {participant.avatarUrl ? <img src={participant.avatarUrl} alt={participant.displayName} className="h-full w-full object-cover" /> : getAvatarInitials(participant.displayName)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[color:var(--text-main)]">{participant.displayName}</p>
                  <p className="text-xs text-[color:var(--text-muted)]">{participant.userId === userId ? "You" : "Connected"}</p>
                </div>
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
    return <div className="rounded-[18px] bg-[color:var(--bg-elevated)] p-4 text-sm text-[color:var(--text-muted)]">Select a tool from the right rail to open its compact options panel.</div>;
  };

  if (isRoomLoading) return <main className="flex min-h-screen items-center justify-center p-6"><Card className="max-w-md space-y-3 p-8 text-center"><h1 className="text-2xl font-semibold">Loading room</h1><p className="text-slate-600">Checking the room link and loading the latest room details.</p></Card></main>;
  if (roomLoadError || expired) return <main className="flex min-h-screen items-center justify-center p-6"><Card className="max-w-md space-y-3 p-8 text-center"><h1 className="text-2xl font-semibold">Room unavailable</h1><p className="text-slate-600">{roomLoadError || "This temporary room is no longer active."}</p><Button className="mt-2" onClick={() => router.push("/")}>Go to home</Button></Card></main>;
  if (roomMeta?.visibility === "private" && !roomReady && !hasRoomAccessGrant(roomMeta.roomId)) return <main className="flex min-h-screen items-center justify-center p-6"><Card className="max-w-md space-y-4 p-8"><div className="space-y-2 text-center"><h1 className="text-2xl font-semibold">Private room</h1><p className="text-slate-600">Enter the password for {roomMeta.name || `room ${roomMeta.roomId}`} to start the live session.</p></div><input type="password" value={privateRoomPassword} onChange={(event) => setPrivateRoomPassword(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !isUnlockingPrivateRoom) void unlockPrivateRoom(); }} className="w-full rounded-2xl border-2 border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2.5 text-sm outline-none ring-0 transition focus:border-[color:var(--primary)] focus:shadow-[0_0_0_3px_rgba(28,117,188,0.16)]" placeholder="Room password" />{privateRoomError && <p className="text-sm text-red-600">{privateRoomError}</p>}<div className="flex flex-col gap-2 sm:flex-row"><Button className="flex-1" onClick={() => void unlockPrivateRoom()} disabled={isUnlockingPrivateRoom}>{isUnlockingPrivateRoom ? "Unlocking..." : "Unlock room"}</Button><SecondaryButton className="flex-1" onClick={() => router.push("/")}>Back home</SecondaryButton></div></Card></main>;

  return (
    <main className={`relative overflow-hidden ${roomReady ? "h-dvh p-1.5 sm:p-2" : "min-h-screen p-3 sm:p-4"}`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,#ffffff_0%,rgba(255,255,255,0.78)_18%,rgba(248,244,232,0)_58%)]" />
      <div className={`relative mx-auto flex h-full min-h-0 w-full max-w-[1920px] gap-2 overflow-hidden rounded-[28px] border border-white/60 bg-[linear-gradient(150deg,rgba(12,26,43,0.07),rgba(255,255,255,0.78))] p-2 shadow-[0_26px_70px_rgba(26,26,26,0.14)] ${roomReady ? "" : "min-h-[calc(100vh-1.5rem)]"}`}>
        <aside className={`relative z-30 shrink-0 ${isTouchWorkspace ? "w-[56px]" : "w-[68px] xl:w-[72px]"}`}>
          <div className={`${sidebarShell} flex h-full w-full flex-col items-center gap-1.5 py-1.5`}>
            <button type="button" className={railButtonBase} onClick={() => getSocket().emit(SOCKET_EVENTS.STROKE_UNDO, { roomId, userId })} disabled={!hasJoined || !canUndo} aria-label="Undo"><Undo2 size={18} /></button>
            <button type="button" className={railButtonBase} onClick={() => getSocket().emit(SOCKET_EVENTS.STROKE_REDO, { roomId, userId })} disabled={!hasJoined || !canRedo} aria-label="Redo"><Redo2 size={18} /></button>
            <button type="button" className={railButtonBase} onClick={download} disabled={!hasJoined} aria-label="Export board"><Download size={18} /></button>
            <button type="button" className={railButtonBase} onClick={() => setIsClearModalOpen(true)} disabled={!hasJoined} aria-label="Clear board"><Trash2 size={18} /></button>
            <button type="button" className={railButtonBase} onClick={() => { navigator.clipboard.writeText(window.location.href); pushToast("Room link copied."); }} aria-label="Copy room link"><Link2 size={18} /></button>
            <button type="button" className={`${railButtonBase} relative ${activeFunctionPanel === "chat" ? "bg-[color:var(--brand-blue)] text-white" : ""}`} onClick={(event) => { event.stopPropagation(); setActiveToolPanel(null); setActiveFunctionPanel((value) => value === "chat" ? null : "chat"); }} aria-label="Open chat"><MessageSquare size={18} />{!!chatMessages.length && <span className={railBadge}>{Math.min(chatMessages.length, 9)}</span>}</button>
            <div className="mt-auto" />
            <button type="button" className={`${railButtonBase} text-[color:var(--brand-red)]`} onClick={() => setIsExitModalOpen(true)} aria-label="Leave room"><LogOut size={18} /></button>
          </div>
        </aside>

        <section className="relative min-h-0 flex-1 overflow-hidden rounded-[26px] bg-[linear-gradient(180deg,rgba(199,232,255,0.95),rgba(231,244,253,0.94))] ring-1 ring-black/5">
          {connectionMessage && (
            <div className={`pointer-events-none absolute left-3 top-3 z-30 rounded-full px-3 py-1.5 text-[11px] font-semibold shadow-sm ${error || status === "reconnecting" || status === "disconnected" ? "bg-[color:var(--danger-soft)] text-[#8f2323]" : "bg-white/92 text-[color:var(--text-muted)]"}`}>{connectionMessage}</div>
          )}

          <CanvasBoard
            roomId={roomId}
            userId={userId}
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
            compact={isTouchWorkspace}
            onSurfaceInteract={() => closeFloatingPanels()}
          />

          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 p-2 sm:p-3">
            <div className="pointer-events-auto flex flex-wrap items-end justify-between gap-3 rounded-[20px] bg-white/72 px-3 py-2.5 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur-md">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex -space-x-2">
                  {participantPreview.map((participant) => (
                    <span key={participant.socketId} className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-slate-900 text-[11px] font-semibold text-white shadow-sm">
                      {participant.avatarUrl ? <img src={participant.avatarUrl} alt={participant.displayName} className="h-full w-full object-cover" /> : getAvatarInitials(participant.displayName)}
                    </span>
                  ))}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-[color:var(--text-main)]">{roomTitle}</p>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-[color:var(--text-muted)]">
                    <span>{participants.length} collaborator{participants.length === 1 ? "" : "s"}</span>
                    <span className="h-1 w-1 rounded-full bg-[color:var(--text-muted)]/50" />
                    <span className="capitalize">{roomMeta?.visibility ?? "public"}</span>
                    {mode === "guess-mode" && <><span className="h-1 w-1 rounded-full bg-[color:var(--text-muted)]/50" /><span>Guess mode</span></>}
                  </div>
                </div>
              </div>
              <div className="text-[11px] font-medium text-[color:var(--text-muted)]">Landscape-first workspace • tap board to dismiss panels</div>
            </div>
          </div>

          {landscapeHintNeeded && isTouchWorkspace && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-[rgba(12,22,34,0.58)] p-6 text-center text-white backdrop-blur-sm">
              <div className="max-w-sm rounded-[28px] border border-white/15 bg-[rgba(15,23,42,0.78)] p-5 shadow-2xl">
                <h2 className="text-xl font-bold">Rotate to landscape for the best board space</h2>
                <p className="mt-2 text-sm text-white/80">The room stays in workspace mode, but landscape gives you the largest shared drawing surface and cleaner rails.</p>
              </div>
            </div>
          )}

          {reactionBursts.map((burst) => (
            <span key={burst.id} className="pointer-events-none absolute bottom-12 z-30 animate-[float-up_2.2s_ease-in_forwards] text-4xl drop-shadow-lg" style={{ left: `${burst.left}%` }}>{burst.emoji}</span>
          ))}
        </section>

        <aside className={`relative z-30 shrink-0 ${isTouchWorkspace ? "w-[56px]" : "w-[68px] xl:w-[72px]"}`}>
          <div className={`${sidebarShell} flex h-full w-full flex-col items-center gap-1.5 py-1.5`}>
            {[
              { id: "brush", icon: Brush, active: activeToolPanel === "brush", onClick: () => { setTool("pen"); openToolPanel("brush"); }, label: "Brush" },
              { id: "eraser", icon: Eraser, active: activeToolPanel === "eraser", onClick: () => { setTool("eraser"); openToolPanel("eraser"); }, label: "Eraser" },
              { id: "fill", icon: PaintBucket, active: activeToolPanel === "fill", onClick: () => { setTool("fill"); openToolPanel("fill"); }, label: "Fill" },
              { id: "shapes", icon: Shapes, active: activeToolPanel === "shapes", onClick: () => openToolPanel("shapes"), label: "Shapes" },
              { id: "reactions", icon: Sparkles, active: activeToolPanel === "reactions", onClick: () => openToolPanel("reactions"), label: "Reactions" },
              { id: "info", icon: Info, active: activeToolPanel === "info", onClick: () => openToolPanel("info"), label: "Room info" },
            ].map(({ id, icon: Icon, active, onClick, label }) => (
              <button key={id} type="button" className={`${railButtonBase} ${active ? "bg-[color:var(--brand-blue)] text-white" : ""}`} onClick={(event) => { event.stopPropagation(); onClick(); }} aria-label={label}><Icon size={18} /></button>
            ))}
          </div>
        </aside>

        {activeFunctionPanel === "chat" && (
          <div ref={functionPanelRef} className={`absolute bottom-4 left-[calc(0.5rem+56px)] z-40 w-[min(340px,calc(100vw-5rem))] sm:left-[calc(0.75rem+72px)] ${floatingPanelCard}`}>
            <div className="mb-3 flex items-center justify-between gap-2"><div><p className="text-sm font-black text-[color:var(--text-main)]">Chat</p><p className="text-xs text-[color:var(--text-muted)]">Room messages stay synced in realtime.</p></div><button type="button" className="rounded-full p-1 text-[color:var(--text-muted)] hover:bg-[color:var(--surface-soft)]" onClick={() => setActiveFunctionPanel(null)}><X size={16} /></button></div>
            <div className="max-h-[40vh] space-y-2 overflow-y-auto pr-1">
              {chatMessages.length === 0 ? <div className="rounded-[18px] bg-[color:var(--bg-elevated)] px-3 py-4 text-sm text-[color:var(--text-muted)]">No messages yet. Start the conversation.</div> : chatMessages.map((message) => (
                <div key={message.messageId} className="rounded-[18px] bg-[color:var(--bg-elevated)] px-3 py-2.5">
                  <div className="flex items-center gap-2"><span className="text-sm font-semibold text-[color:var(--text-main)]">{message.displayName}</span><span className="text-[11px] text-[color:var(--text-muted)]">{new Date(message.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span></div>
                  <p className="mt-1 text-sm text-[color:var(--text-main)]">{message.text}</p>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="mt-3 flex gap-2"><input value={chatDraft} onChange={(event) => setChatDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") sendChat(); }} placeholder="Send a message" className="min-w-0 flex-1 rounded-[16px] border border-black/5 bg-[color:var(--bg-elevated)] px-3 py-2 text-sm outline-none focus:border-[color:var(--brand-blue)]" maxLength={240} /><Button className="px-4 py-2 text-sm" onClick={sendChat}>Send</Button></div>
          </div>
        )}

        {activeToolPanel && (
          <div ref={toolPanelRef} className={`absolute right-[calc(0.5rem+56px)] top-4 z-40 w-[min(320px,calc(100vw-5rem))] sm:right-[calc(0.75rem+72px)] ${floatingPanelCard}`}>
            <div className="mb-3 flex items-center justify-between gap-2"><div><p className="text-sm font-black capitalize text-[color:var(--text-main)]">{activeToolPanel === "info" ? "Room info" : activeToolPanel}</p><p className="text-xs text-[color:var(--text-muted)]">Compact controls that keep the board dominant.</p></div><button type="button" className="rounded-full p-1 text-[color:var(--text-muted)] hover:bg-[color:var(--surface-soft)]" onClick={() => setActiveToolPanel(null)}><X size={16} /></button></div>
            {renderToolPanelContent()}
          </div>
        )}
      </div>

      <ConfirmModal title="Clear the board?" description="This removes all strokes for everyone in the room." open={isClearModalOpen} onCancel={() => setIsClearModalOpen(false)} onConfirm={clearBoard} confirmLabel="Clear board" />
      <ConfirmModal title="Leave room?" description="You can rejoin later with the room link while it remains active." open={isExitModalOpen} onCancel={() => setIsExitModalOpen(false)} onConfirm={() => void leaveRoomSafely()} confirmLabel="Leave room" />
      <ToastStack toasts={toasts} />
    </main>
  );
}
