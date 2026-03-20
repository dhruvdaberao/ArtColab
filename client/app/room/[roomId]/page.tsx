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

type ToolPanel = "brush" | "eraser" | "fill" | "shapes" | "reactions" | null;
type FunctionPanel = "chat" | null;

const sidebarShell =
  "rounded-[28px] border border-[color:var(--border)]/10 bg-white/80 p-2 shadow-[0_18px_50px_rgba(26,26,26,0.12)] backdrop-blur";
const railButtonBase =
  "group flex h-12 w-12 items-center justify-center rounded-2xl border border-[color:var(--border)]/10 bg-white text-[color:var(--text-main)] shadow-[0_6px_18px_rgba(26,26,26,0.08)] transition hover:-translate-y-0.5 hover:bg-[color:var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-40";
const floatingPanelCard =
  "rounded-[22px] border border-[color:var(--border)]/10 bg-white/96 p-3 shadow-[0_18px_40px_rgba(26,26,26,0.18)] backdrop-blur-xl";
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
  const [isTouchWorkspace, setIsTouchWorkspace] = useState(false);
  const [landscapeHintNeeded, setLandscapeHintNeeded] = useState(false);
  const [activeToolPanel, setActiveToolPanel] = useState<ToolPanel>("brush");
  const [activeFunctionPanel, setActiveFunctionPanel] =
    useState<FunctionPanel>(null);
  const [showParticipants, setShowParticipants] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const joinedToastShownRef = useRef(false);
  const isMountedRef = useRef(true);
  const colorInputRef = useRef<HTMLInputElement | null>(null);
  const fillColorInputRef = useRef<HTMLInputElement | null>(null);
  const orientationLockedRef = useRef(false);
  const toolPanelRef = useRef<HTMLDivElement | null>(null);
  const functionPanelRef = useRef<HTMLDivElement | null>(null);
  const participantsPanelRef = useRef<HTMLDivElement | null>(null);
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
      const limitedWidth = window.innerWidth <= 1280;
      setIsTouchWorkspace(coarsePointer && limitedWidth);
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
      )
        screenOrientation.unlock();
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
    if (!isTouchWorkspace) {
      document.body.classList.remove("room-workspace-body");
      document.documentElement.classList.remove("room-workspace-root");
      return;
    }
    document.body.classList.add("room-workspace-body");
    document.documentElement.classList.add("room-workspace-root");
    const screenOrientation = window.screen.orientation as ScreenOrientation & {
      lock?: (orientation: string) => Promise<void>;
    };
    const tryLock = async () => {
      if (typeof screenOrientation.lock !== "function") return;
      try {
        if (!document.fullscreenElement)
          await document.documentElement.requestFullscreen();
        await screenOrientation.lock("landscape");
        orientationLockedRef.current = true;
      } catch {
        setLandscapeHintNeeded(window.innerHeight > window.innerWidth);
      }
    };
    void tryLock();
    return () => {
      void resetWorkspaceMode({ preserveState: true });
    };
  }, [isTouchWorkspace, resetWorkspaceMode]);

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
  const isShapeTool = SHAPE_OPTIONS.some((shape) => shape.tool === tool);

  const closeFloatingPanels = useCallback(
    (options: { keep?: "tool" | "function" | "participants" | null } = {}) => {
      if (options.keep !== "tool") setActiveToolPanel(null);
      if (options.keep !== "function") setActiveFunctionPanel(null);
      if (options.keep !== "participants") setShowParticipants(false);
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
      if (participantsPanelRef.current?.contains(target)) return;
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
      const message =
        error instanceof Error ? error.message : "Unable to unlock room.";
      setPrivateRoomError(message);
    } finally {
      setIsUnlockingPrivateRoom(false);
    }
  }, [privateRoomPassword, pushToast, roomMeta]);

  const renderToolPanelContent = () => {
    if (activeToolPanel === "brush")
      return (
        <div className="space-y-4">
          <div>
            <p className={controlLabel}>Brush style</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {BRUSH_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`rounded-2xl border px-3 py-2 text-sm font-semibold transition ${brushStyle === option.id ? "border-transparent bg-[color:var(--brand-blue)] text-white" : "border-[color:var(--border)]/10 bg-[color:var(--bg-elevated)] hover:bg-[color:var(--surface-soft)]"}`}
                  onClick={() => {
                    setTool("pen");
                    setBrushStyle(option.id);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between gap-3">
              <p className={controlLabel}>Thickness</p>
              <span className="rounded-full bg-[color:var(--surface-soft)] px-2 py-1 text-xs font-bold">
                {size}px
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={24}
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              className="mt-2 w-full accent-[color:var(--brand-blue)]"
            />
          </div>
          <div>
            <div className="flex items-center justify-between gap-3">
              <p className={controlLabel}>Stroke color</p>
              <button
                type="button"
                className="h-9 w-9 rounded-full border border-[color:var(--border)]/10"
                style={{ backgroundColor: strokeColor }}
                onClick={() => colorInputRef.current?.click()}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {[
                ...recentColors,
                ...PRESET_COLORS.filter(
                  (color) => !recentColors.includes(color),
                ),
              ]
                .slice(0, 8)
                .map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`h-9 w-9 rounded-full border-2 ${strokeColor.toLowerCase() === color.toLowerCase() ? "border-[color:var(--text-main)]" : "border-transparent"}`}
                    style={{ backgroundColor: color }}
                    onClick={() => updateStrokeColor(color)}
                  />
                ))}
              <input
                ref={colorInputRef}
                type="color"
                value={strokeColor}
                onChange={(e) => updateStrokeColor(e.target.value)}
                className="sr-only"
              />
            </div>
          </div>
        </div>
      );
    if (activeToolPanel === "eraser")
      return (
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between gap-3">
              <p className={controlLabel}>Eraser size</p>
              <span className="rounded-full bg-[color:var(--surface-soft)] px-2 py-1 text-xs font-bold">
                {size}px
              </span>
            </div>
            <input
              type="range"
              min={4}
              max={32}
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              className="mt-2 w-full accent-[color:var(--brand-blue)]"
            />
          </div>
          <div className="rounded-[20px] bg-[color:var(--bg-elevated)] p-3 text-sm text-[color:var(--text-muted)]">
            The eraser keeps the same precise coordinate mapping and clears with
            the existing realtime stroke logic.
          </div>
        </div>
      );
    if (activeToolPanel === "fill")
      return (
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between gap-3">
              <p className={controlLabel}>Fill color</p>
              <button
                type="button"
                className="h-9 w-9 rounded-full border border-[color:var(--border)]/10"
                style={{ backgroundColor: fillColor }}
                onClick={() => fillColorInputRef.current?.click()}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {[
                ...recentColors,
                ...PRESET_COLORS.filter(
                  (color) => !recentColors.includes(color),
                ),
              ]
                .slice(0, 8)
                .map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`h-9 w-9 rounded-full border-2 ${fillColor.toLowerCase() === color.toLowerCase() ? "border-[color:var(--text-main)]" : "border-transparent"}`}
                    style={{ backgroundColor: color }}
                    onClick={() => updateFillColor(color)}
                  />
                ))}
              <input
                ref={fillColorInputRef}
                type="color"
                value={fillColor}
                onChange={(e) => updateFillColor(e.target.value)}
                className="sr-only"
              />
            </div>
          </div>
          <div className="rounded-[20px] bg-[color:var(--bg-elevated)] p-3 text-sm text-[color:var(--text-muted)]">
            Flood fill stays intentionally simple so the interaction remains
            fast and clean.
          </div>
        </div>
      );
    if (activeToolPanel === "shapes")
      return (
        <div className="space-y-4">
          <div>
            <p className={controlLabel}>Choose a shape</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {SHAPE_OPTIONS.map(({ tool: shapeTool, label, icon: Icon }) => (
                <button
                  key={shapeTool}
                  type="button"
                  className={`flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold transition ${tool === shapeTool ? "border-transparent bg-[color:var(--brand-blue)] text-white" : "border-[color:var(--border)]/10 bg-[color:var(--bg-elevated)] hover:bg-[color:var(--surface-soft)]"}`}
                  onClick={() => setTool(shapeTool)}
                >
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
                <button
                  key={color}
                  type="button"
                  className={`h-8 w-8 rounded-full border-2 ${strokeColor.toLowerCase() === color.toLowerCase() ? "border-[color:var(--text-main)]" : "border-transparent"}`}
                  style={{ backgroundColor: color }}
                  onClick={() => updateStrokeColor(color)}
                />
              ))}
            </div>
          </div>
          <label className="flex items-center justify-between gap-3 rounded-[20px] bg-[color:var(--bg-elevated)] px-3 py-3 text-sm text-[color:var(--text-main)]">
            <div>
              <p className="font-semibold">Fill closed shapes</p>
              <p className="text-xs text-[color:var(--text-muted)]">
                Use the selected fill color for rectangles, circles, triangles,
                and stars.
              </p>
            </div>
            <input
              type="checkbox"
              checked={fillEnabled}
              onChange={(e) => setFillEnabled(e.target.checked)}
              className="h-4 w-4"
            />
          </label>
        </div>
      );
    if (activeToolPanel === "reactions")
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-5 gap-2">
            {REACTIONS.map(({ emoji, label }) => (
              <button
                key={emoji}
                type="button"
                className="flex aspect-square items-center justify-center rounded-2xl border border-[color:var(--border)]/10 bg-[color:var(--bg-elevated)] text-2xl transition hover:-translate-y-0.5 hover:bg-[color:var(--surface-soft)]"
                onClick={() => sendReaction(emoji)}
                title={label}
                aria-label={label}
              >
                {emoji}
              </button>
            ))}
          </div>
          <p className="text-sm text-[color:var(--text-muted)]">
            Reaction bursts reuse the existing realtime event pipeline and are
            deduplicated before animating over the board.
          </p>
        </div>
      );
    return (
      <div className="rounded-[20px] bg-[color:var(--bg-elevated)] p-4 text-sm text-[color:var(--text-muted)]">
        Select a tool from the right rail to open its compact options panel.
      </div>
    );
  };

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
              if (event.key === "Enter" && !isUnlockingPrivateRoom)
                void unlockPrivateRoom();
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

  const roomTitle = roomMeta?.name || `Room ${roomId}`;
  const participantPreview = participants.slice(0, 4);
  const connectionMessage =
    error ||
    (status === "connecting" && "Connecting to the collaboration server…") ||
    (status === "reconnecting" &&
      "Realtime connection dropped. Trying to reconnect…") ||
    (status === "disconnected" &&
      "Realtime connection is offline right now. We’ll reconnect automatically when possible.") ||
    null;

  return (
    <main
      className={`relative overflow-hidden ${isTouchWorkspace ? "h-dvh p-1.5 sm:p-2" : "min-h-screen p-3 sm:p-4 lg:p-5"}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,#ffffff_0%,rgba(255,255,255,0.68)_20%,rgba(248,244,232,0)_56%)]" />
      <div
        className={`relative mx-auto flex min-h-0 overflow-hidden rounded-[28px] border border-white/70 bg-[linear-gradient(150deg,rgba(12,26,43,0.08),rgba(255,255,255,0.78))] shadow-[0_30px_80px_rgba(26,26,26,0.16)] ${isTouchWorkspace ? "h-full max-w-none" : "min-h-[calc(100vh-2.5rem)] max-w-[1800px]"}`}
      >
        <section className="relative flex min-h-0 flex-1 items-stretch gap-2 p-2">
          <aside
            className={`relative z-30 flex shrink-0 ${isTouchWorkspace ? "w-[58px]" : "w-[76px] xl:w-[84px]"}`}
          >
            <div
              className={`${sidebarShell} flex h-full w-full flex-col items-center gap-2 py-2`}
            >
              <button
                type="button"
                className={railButtonBase}
                onClick={() =>
                  getSocket().emit(SOCKET_EVENTS.STROKE_UNDO, {
                    roomId,
                    userId,
                  })
                }
                disabled={!hasJoined || !canUndo}
                aria-label="Undo"
              >
                <Undo2 size={18} />
              </button>
              <button
                type="button"
                className={railButtonBase}
                onClick={() =>
                  getSocket().emit(SOCKET_EVENTS.STROKE_REDO, {
                    roomId,
                    userId,
                  })
                }
                disabled={!hasJoined || !canRedo}
                aria-label="Redo"
              >
                <Redo2 size={18} />
              </button>
              <button
                type="button"
                className={railButtonBase}
                onClick={download}
                disabled={!hasJoined}
                aria-label="Export board"
              >
                <Download size={18} />
              </button>
              <button
                type="button"
                className={railButtonBase}
                onClick={() => setIsClearModalOpen(true)}
                disabled={!hasJoined}
                aria-label="Clear board"
              >
                <Trash2 size={18} />
              </button>
              <button
                type="button"
                className={railButtonBase}
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  pushToast("Room link copied.");
                }}
                aria-label="Copy room link"
              >
                <Link2 size={18} />
              </button>
              <button
                type="button"
                className={`${railButtonBase} ${activeFunctionPanel === "chat" ? "bg-[color:var(--brand-blue)] text-white" : ""}`}
                onClick={(event) => {
                  event.stopPropagation();
                  setShowParticipants(false);
                  setActiveToolPanel(null);
                  setActiveFunctionPanel((value) =>
                    value === "chat" ? null : "chat",
                  );
                }}
                aria-label="Open chat"
              >
                <MessageSquare size={18} />
              </button>
              <div className="mt-auto" />
              <button
                type="button"
                className={`${railButtonBase} text-[color:var(--brand-red)]`}
                onClick={() => setIsExitModalOpen(true)}
                aria-label="Leave room"
              >
                <LogOut size={18} />
              </button>
            </div>
          </aside>

          <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[24px] border border-[color:var(--border)]/10 bg-[linear-gradient(180deg,rgba(219,240,255,0.9),rgba(241,248,253,0.92))]">
            <div className="pointer-events-none absolute inset-x-0 top-0 z-20 p-2 sm:p-3">
              <div className="pointer-events-auto flex items-start justify-between gap-2 rounded-[18px] border border-[color:var(--border)]/10 bg-white/78 px-3 py-2 shadow-[0_10px_28px_rgba(26,26,26,0.1)] backdrop-blur-md">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-[color:var(--text-main)] sm:text-[15px]">
                    {roomTitle}
                  </p>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
                    <span>{roomId}</span>
                    <span className="h-1 w-1 rounded-full bg-[color:var(--text-muted)]/45" />
                    <span className="capitalize">
                      {roomMeta?.visibility ?? "public"}
                    </span>
                    {mode === "guess-mode" && (
                      <>
                        <span className="h-1 w-1 rounded-full bg-[color:var(--text-muted)]/45" />
                        <span>Guess mode</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  {connectionMessage && (
                    <div
                      className={`max-w-[220px] rounded-full px-2.5 py-1 text-[10px] font-semibold shadow-sm ${error || status === "reconnecting" || status === "disconnected" ? "bg-[color:var(--danger-soft)] text-[#8f2323]" : "bg-[color:var(--surface-soft)] text-[color:var(--text-muted)]"}`}
                    >
                      {connectionMessage}
                    </div>
                  )}
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-full border border-[color:var(--border)]/10 bg-white/90 px-2 py-1.5 shadow-sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      setActiveToolPanel(null);
                      setActiveFunctionPanel(null);
                      setShowParticipants((value) => !value);
                    }}
                    aria-label="Show participants"
                  >
                    <div className="flex -space-x-2">
                      {participantPreview.map((participant) => (
                        <span
                          key={participant.socketId}
                          className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[color:var(--surface-soft)] text-[10px] font-bold text-[color:var(--text-main)] shadow-sm"
                        >
                          {participant.avatarUrl ? (
                            <img
                              src={participant.avatarUrl}
                              alt={participant.displayName}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            getAvatarInitials(participant.displayName)
                          )}
                        </span>
                      ))}
                      {participantPreview.length === 0 && (
                        <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[color:var(--surface-soft)] text-[color:var(--text-muted)]">
                          <Users size={12} />
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-[color:var(--text-main)]">
                      {participants.length}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <div className="relative flex min-h-0 flex-1 items-stretch px-2 pb-2 pt-16 sm:px-3 sm:pb-3 sm:pt-[4.5rem]">
              <div
                className="relative min-h-0 flex-1"
                onPointerDown={() => closeFloatingPanels()}
              >
                <div className="relative flex h-full min-h-0 flex-col rounded-[24px] border border-[color:var(--border)]/10 bg-[linear-gradient(160deg,#d9efff_0%,#eef9ff_45%,#f6fafc_100%)] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] sm:p-2">
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
                    compact={isTouchWorkspace}
                    onSurfaceInteract={() => closeFloatingPanels()}
                  />
                  <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[24px]">
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
            </div>

            {landscapeHintNeeded && isTouchWorkspace && (
              <div className="pointer-events-none absolute inset-0 z-40 grid place-items-center bg-[rgba(12,22,34,0.44)] p-4">
                <div className="pointer-events-auto max-w-xs rounded-[24px] border border-white/20 bg-[rgba(12,22,34,0.9)] px-5 py-4 text-center text-white shadow-2xl backdrop-blur">
                  <p className="text-sm font-black">
                    Landscape workspace enabled
                  </p>
                  <p className="mt-1 text-xs text-white/80">
                    If your browser ignores orientation lock, rotate wider to
                    reveal the full board workspace.
                  </p>
                </div>
              </div>
            )}

            {showParticipants && (
              <div
                className="absolute right-3 top-[4.8rem] z-40"
                ref={participantsPanelRef}
              >
                <div
                  className={`${floatingPanelCard} w-[min(320px,calc(100vw-8rem))]`}
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <p className={controlLabel}>Live room</p>
                      <p className="text-sm font-black text-[color:var(--text-main)]">
                        Participants
                      </p>
                    </div>
                    <button
                      type="button"
                      className="rounded-full p-1 text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-soft)]"
                      onClick={() => setShowParticipants(false)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <ParticipantsPanel
                    participants={participants}
                    userId={userId}
                    compact
                  />
                </div>
              </div>
            )}

            {activeFunctionPanel === "chat" && (
              <div
                className={`absolute left-3 z-40 ${isTouchWorkspace ? "top-auto bottom-3" : "top-[4.8rem]"}`}
                ref={functionPanelRef}
              >
                <div
                  className={`${floatingPanelCard} flex w-[min(340px,calc(100vw-8rem))] max-h-[min(58vh,520px)] flex-col`}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className={controlLabel}>Room chat</p>
                      <h2 className="mt-1 text-base font-black text-[color:var(--text-main)]">
                        Discuss the sketch
                      </h2>
                    </div>
                    <button
                      type="button"
                      className="rounded-full p-1 text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-soft)]"
                      onClick={() => setActiveFunctionPanel(null)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-[18px] border border-[color:var(--border)]/10 bg-[color:var(--bg-elevated)] p-3 text-sm">
                    {chatMessages.length === 0 ? (
                      <p className="text-xs text-[color:var(--text-muted)]">
                        No messages yet. Introduce the sketch or share feedback.
                      </p>
                    ) : (
                      chatMessages.map((message) => (
                        <div
                          key={message.messageId}
                          className="rounded-2xl bg-white px-3 py-2 shadow-sm"
                        >
                          <p className="text-xs font-semibold text-[color:var(--text-muted)]">
                            {message.displayName}
                          </p>
                          <p className="mt-1 text-sm text-[color:var(--text-main)]">
                            {message.text}
                          </p>
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
                      className="w-full rounded-2xl border border-[color:var(--border)]/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-[color:var(--brand-blue)]"
                      placeholder={
                        mode === "guess-mode"
                          ? "Guess the drawing..."
                          : "Send a message"
                      }
                    />
                    <Button
                      onClick={sendChat}
                      className="min-h-10 rounded-2xl px-4 text-sm"
                    >
                      Send
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </section>

          <aside
            className={`relative z-30 flex shrink-0 ${isTouchWorkspace ? "w-[58px]" : "w-[76px] xl:w-[84px]"}`}
          >
            <div
              className={`${sidebarShell} flex h-full w-full flex-col items-center gap-2 py-2`}
            >
              <button
                type="button"
                className={`${railButtonBase} ${activeToolPanel === "brush" ? "bg-[color:var(--brand-blue)] text-white" : ""}`}
                onClick={(event) => {
                  event.stopPropagation();
                  setActiveFunctionPanel(null);
                  setShowParticipants(false);
                  setTool("pen");
                  setActiveToolPanel((value) =>
                    value === "brush" ? null : "brush",
                  );
                }}
                aria-label="Brush tool"
              >
                <Brush size={18} />
              </button>
              <button
                type="button"
                className={`${railButtonBase} ${activeToolPanel === "eraser" ? "bg-[color:var(--brand-blue)] text-white" : ""}`}
                onClick={(event) => {
                  event.stopPropagation();
                  setActiveFunctionPanel(null);
                  setShowParticipants(false);
                  setTool("eraser");
                  setActiveToolPanel((value) =>
                    value === "eraser" ? null : "eraser",
                  );
                }}
                aria-label="Eraser tool"
              >
                <Eraser size={18} />
              </button>
              <button
                type="button"
                className={`${railButtonBase} ${activeToolPanel === "fill" ? "bg-[color:var(--brand-blue)] text-white" : ""}`}
                onClick={(event) => {
                  event.stopPropagation();
                  setActiveFunctionPanel(null);
                  setShowParticipants(false);
                  setTool("fill");
                  setFillEnabled(true);
                  setActiveToolPanel((value) =>
                    value === "fill" ? null : "fill",
                  );
                }}
                aria-label="Fill tool"
              >
                <PaintBucket size={18} />
              </button>
              <button
                type="button"
                className={`${railButtonBase} ${activeToolPanel === "shapes" ? "bg-[color:var(--brand-blue)] text-white" : ""}`}
                onClick={(event) => {
                  event.stopPropagation();
                  setActiveFunctionPanel(null);
                  setShowParticipants(false);
                  if (!isShapeTool) setTool("rectangle");
                  setActiveToolPanel((value) =>
                    value === "shapes" ? null : "shapes",
                  );
                }}
                aria-label="Shapes tool"
              >
                <Shapes size={18} />
              </button>
              <button
                type="button"
                className={`${railButtonBase} ${activeToolPanel === "reactions" ? "bg-[color:var(--brand-blue)] text-white" : ""}`}
                onClick={(event) => {
                  event.stopPropagation();
                  setActiveFunctionPanel(null);
                  setShowParticipants(false);
                  setActiveToolPanel((value) =>
                    value === "reactions" ? null : "reactions",
                  );
                }}
                aria-label="Reactions"
              >
                <Sparkles size={18} />
              </button>
              <div className="mt-auto" />
              <button
                type="button"
                className={railButtonBase}
                onClick={() => setResetViewSignal((value) => value + 1)}
                aria-label="Reset view"
              >
                <PencilRuler size={18} />
              </button>
            </div>
          </aside>

          {activeToolPanel && (
            <div
              className={`absolute right-[calc(${isTouchWorkspace ? "58px" : "76px"}+1rem)] top-[4.8rem] z-40 ${isTouchWorkspace ? "max-w-[calc(100vw-8.5rem)]" : ""}`}
              ref={toolPanelRef}
            >
              <div
                className={`${floatingPanelCard} w-[min(340px,calc(100vw-9rem))] max-h-[min(62vh,560px)] overflow-y-auto`}
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className={controlLabel}>Drawing tools</p>
                    <h2 className="mt-1 text-base font-black text-[color:var(--text-main)]">
                      {activeToolPanel === "brush"
                        ? "Brush settings"
                        : activeToolPanel === "eraser"
                          ? "Eraser settings"
                          : activeToolPanel === "fill"
                            ? "Fill settings"
                            : activeToolPanel === "shapes"
                              ? "Shape settings"
                              : "Quick reactions"}
                    </h2>
                  </div>
                  <button
                    type="button"
                    className="rounded-full p-1 text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-soft)]"
                    onClick={() => setActiveToolPanel(null)}
                  >
                    <X size={16} />
                  </button>
                </div>
                {renderToolPanelContent()}
              </div>
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
