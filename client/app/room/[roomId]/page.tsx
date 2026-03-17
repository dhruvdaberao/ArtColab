"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { useAuth } from "@/components/auth-provider";
import { UserAvatarMenu } from "@/components/user-avatar-menu";

const REACTIONS = ["❤️", "😂", "😮", "🔥", "🎉"] as const;

export default function RoomPage() {
  const params = useParams<{ roomId: string }>();
  const router = useRouter();
  const roomId = useMemo(() => params.roomId.toUpperCase(), [params.roomId]);
  const isValidRoomId = /^[A-Z0-9]{6}$/.test(roomId);
  const [tool, setTool] = useState<DrawingTool>("pen");
  const [brushStyle, setBrushStyle] = useState<BrushStyle>("classic");
  const [stickerMode, setStickerMode] = useState<string | null>(null);
  const [color, setColor] = useState("#0f172a");
  const [size, setSize] = useState(4);
  const [userId, setUserId] = useState("");
  const [displayName, setDisplayName] = useState("Guest");
  const [roomReady, setRoomReady] = useState(false);
  const [roomLoadError, setRoomLoadError] = useState<string | null>(null);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [reactionBursts, setReactionBursts] = useState<Array<{ id: string; emoji: string; left: number }>>([]);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const joinedToastShownRef = useRef(false);
  const { user } = useAuth();

  const pushToast = useCallback((message: string) => {
    const id = nanoid();
    setToasts((prev) => [...prev, { id, message }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((toast) => toast.id !== id)), 1900);
  }, []);

  useEffect(() => {
    const existing = localStorage.getItem("cloudcanvas-user-id");
    if (existing) setUserId(existing);
    else {
      const next = crypto.randomUUID();
      localStorage.setItem("cloudcanvas-user-id", next);
      setUserId(next);
    }
    setDisplayName(localStorage.getItem("cloudcanvas-display-name") ?? user?.username ?? "Guest");
  }, [user?.username]);

  useEffect(() => {
    if (!isValidRoomId) return setRoomLoadError("Invalid room code."), setRoomReady(false);
    getRoom(roomId).then(() => setRoomReady(true)).catch((error: Error) => setRoomLoadError(error.message || "Room unavailable."));
  }, [roomId, isValidRoomId]);

  const avatarUrl = user?.profileImage;
  const {
    participants,
    strokes,
    setStrokes,
    stickers,
    setStickers,
    chatMessages,
    mode,
    cursors,
    status,
    expired,
    error,
    hasJoined,
    setError,
    leaveRoom: leaveSocketRoom,
  } = useRoomSocket(roomReady ? roomId : "", roomReady ? userId : "", displayName, avatarUrl);

  const clearBoard = () => {
    socket.emit(SOCKET_EVENTS.BOARD_CLEAR, { roomId });
    setStrokes([]);
    setStickers([]);
    setIsClearModalOpen(false);
    pushToast("Chaos reset. Fresh canvas unlocked ✨");
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
    ctx.fillStyle = "#7c3aed";
    ctx.font = "bold 24px sans-serif";
    ctx.fillText("Made on SprinkleSketch 🎨", 16, exportCanvas.height - 14);
    const link = document.createElement("a");
    link.download = `sprinklesketch-${roomId}.png`;
    link.href = exportCanvas.toDataURL("image/png");
    link.click();
  };

  const copyImage = async () => {
    const canvas = document.querySelector("canvas") as HTMLCanvasElement | null;
    if (!canvas || !navigator.clipboard?.write) return;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve));
    if (!blob) return;
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    pushToast("Image copied. Paste your masterpiece anywhere.");
  };

  const sendChat = () => {
    const text = chatDraft.trim();
    if (!text) return;
    socket.emit(SOCKET_EVENTS.CHAT_SEND, { roomId, userId, displayName, avatarUrl, text: text.slice(0, 240) });
    setChatDraft("");
  };

  const sendReaction = (emoji: (typeof REACTIONS)[number]) => {
    socket.emit(SOCKET_EVENTS.REACTION_SEND, { roomId, userId, displayName, emoji });
  };

  useEffect(() => {
    const onReaction = ({ emoji, reactionId }: { emoji: string; reactionId: string }) => {
      const burst = { id: reactionId, emoji, left: Math.floor(Math.random() * 80) + 10 };
      setReactionBursts((prev) => [...prev, burst]);
      window.setTimeout(() => setReactionBursts((prev) => prev.filter((item) => item.id !== burst.id)), 2300);
    };
    socket.on(SOCKET_EVENTS.REACTION_EVENT, onReaction);
    return () => { socket.off(SOCKET_EVENTS.REACTION_EVENT, onReaction); };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages.length]);

  useEffect(() => {
    const onJoined = ({ participant }: { roomId: string; participant: { displayName: string } }) => pushToast(`${participant.displayName} joined the chaos 😈`);
    const onLeft = ({ participant }: { roomId: string; participant: { displayName: string } }) => pushToast(`${participant.displayName} poofed out 👻`);
    socket.on(SOCKET_EVENTS.ROOM_PARTICIPANT_JOINED, onJoined);
    socket.on(SOCKET_EVENTS.ROOM_PARTICIPANT_LEFT, onLeft);
    return () => {
      socket.off(SOCKET_EVENTS.ROOM_PARTICIPANT_JOINED, onJoined);
      socket.off(SOCKET_EVENTS.ROOM_PARTICIPANT_LEFT, onLeft);
    };
  }, [pushToast]);

  useEffect(() => {
    if (hasJoined && !joinedToastShownRef.current) {
      joinedToastShownRef.current = true;
      pushToast("You joined the doodle party!");
    }
  }, [hasJoined, pushToast]);

  if (roomLoadError || expired) return <main className="flex min-h-screen items-center justify-center p-6"><Card className="max-w-md space-y-3 p-8 text-center"><h1 className="text-2xl font-semibold">Room unavailable</h1><p className="text-slate-600">{roomLoadError || "This temporary room is no longer active."}</p><Button className="mt-2" onClick={() => router.push("/")}>Go to home</Button></Card></main>;

  return (
    <main className="min-h-screen overscroll-none px-3 py-4 sm:px-5 sm:py-6">
      <div className="mx-auto flex w-full max-w-[1520px] flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-fuchsia-100 bg-white/95 px-4 py-3 shadow-sm sm:px-5">
          <div><p className="text-[11px] uppercase tracking-[0.18em] text-purple-500">SprinkleSketch Room</p><h1 className="text-lg font-extrabold text-purple-900 sm:text-xl">{roomId}</h1></div>
          <div className="flex flex-wrap items-center gap-2 text-sm"><UserAvatarMenu /><Badge className="capitalize bg-sky-50 text-sky-700 border-sky-100">{status}</Badge><Badge className="bg-violet-50 text-violet-700 border-violet-100">{mode === "guess-mode" ? "Guess Mode" : "Free Draw"}</Badge><SecondaryButton onClick={() => navigator.clipboard.writeText(window.location.href)}>Copy room link</SecondaryButton><Button className="min-h-11 gap-2 bg-rose-500 px-5" onClick={() => setIsExitModalOpen(true)}>🚪 Exit Room</Button></div>
        </header>

        {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>}

        <Toolbar tool={tool} setTool={setTool} brushStyle={brushStyle} setBrushStyle={setBrushStyle} mode={mode} onToggleMode={() => socket.emit(SOCKET_EVENTS.MODE_SET, { roomId, mode: mode === "free-draw" ? "guess-mode" : "free-draw" })} stickerMode={stickerMode} setStickerMode={setStickerMode} color={color} setColor={setColor} size={size} setSize={setSize} onClear={() => setIsClearModalOpen(true)} onUndo={() => socket.emit(SOCKET_EVENTS.STROKE_UNDO, { roomId, userId })} onDownload={download} onCopyImage={copyImage} disabled={!hasJoined} />

        <section className="grid gap-4 xl:grid-cols-[1fr_320px]">
          <div className="relative">
            <CanvasBoard roomId={roomId} userId={userId || "pending"} displayName={displayName} avatarUrl={avatarUrl} tool={tool} brushStyle={brushStyle} stickerMode={stickerMode} color={color} size={size} strokes={strokes} stickers={stickers} cursors={cursors} setStrokes={setStrokes} setStickers={setStickers} disabled={!hasJoined} />
            {strokes.length === 0 && <div className="pointer-events-none absolute inset-0 grid place-items-center p-8"><div className="rounded-3xl border border-fuchsia-100 bg-white/95 px-6 py-5 text-center shadow-sm"><p className="text-sm font-semibold text-purple-700">Unleash your inner artist 🎨</p><p className="mt-1 text-xs text-purple-500">This is chaos. We love it.</p></div></div>}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {reactionBursts.map((burst) => <div key={burst.id} className="absolute bottom-6 text-3xl animate-[float-up_2.2s_ease-out_forwards]" style={{ left: `${burst.left}%` }}>{burst.emoji}</div>)}
            </div>
            <div className="absolute right-3 top-3 flex gap-1 rounded-full bg-white/90 p-1 shadow">
              {REACTIONS.map((emoji) => <button key={emoji} className="rounded-full px-2 py-1 text-lg hover:bg-pink-50" onClick={() => sendReaction(emoji)}>{emoji}</button>)}
            </div>
          </div>
          <div className="space-y-4">
            <ParticipantsPanel participants={participants} userId={userId} />
            <Card className="space-y-2 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-purple-500">Room Chat</p>
              <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-2 text-sm">
                {chatMessages.length === 0 ? <p className="text-xs text-purple-500">No messages yet. Start the chaos conversation.</p> : chatMessages.map((message) => <div key={message.messageId}><span className="font-semibold text-purple-700">{message.displayName}</span>: <span>{message.text}</span></div>)}
                <div ref={chatEndRef} />
              </div>
              <div className="flex gap-2">
                <input value={chatDraft} onChange={(e) => setChatDraft(e.target.value.slice(0, 240))} onKeyDown={(e) => e.key === "Enter" && sendChat()} className="flex-1 rounded-xl border border-fuchsia-100 px-3 py-2 text-sm" placeholder={mode === "guess-mode" ? "Guess the drawing..." : "Drop a fun message..."} />
                <Button onClick={sendChat}>Send</Button>
              </div>
            </Card>
          </div>
        </section>
      </div>
      <ConfirmModal open={isClearModalOpen} title="Clear board?" description="This will remove all strokes + stickers for everyone." confirmLabel="Clear board" cancelLabel="Cancel" destructive onCancel={() => setIsClearModalOpen(false)} onConfirm={clearBoard} />
      <ConfirmModal open={isExitModalOpen} title="Leave room?" description="Are you sure you want to leave this room?" confirmLabel="Leave" cancelLabel="Cancel" destructive onCancel={() => setIsExitModalOpen(false)} onConfirm={() => { leaveSocketRoom(); setIsExitModalOpen(false); router.push("/"); }} />
      <ToastStack toasts={toasts} />
    </main>
  );
}
