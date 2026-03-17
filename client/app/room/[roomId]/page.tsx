"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { nanoid } from "nanoid";
import { SOCKET_EVENTS } from "@cloudcanvas/shared";
import type { DrawingTool } from "@cloudcanvas/shared";
import { CanvasBoard } from "@/components/canvas-board";
import { ConfirmModal } from "@/components/confirm-modal";
import { ParticipantsPanel } from "@/components/participants-panel";
import { ToastStack, type ToastMessage } from "@/components/toast";
import { Toolbar } from "@/components/toolbar";
import { Badge, Button, Card, SecondaryButton } from "@/components/ui";
import { socket } from "@/lib/socket";
import { useRoomSocket } from "@/hooks/use-room-socket";
import { getRoom } from "@/lib/api";

export default function RoomPage() {
  const params = useParams<{ roomId: string }>();
  const router = useRouter();
  const roomId = useMemo(() => params.roomId.toUpperCase(), [params.roomId]);
  const isValidRoomId = /^[A-Z0-9]{6}$/.test(roomId);
  const [tool, setTool] = useState<DrawingTool>("pen");
  const [color, setColor] = useState("#0f172a");
  const [size, setSize] = useState(4);
  const [userId, setUserId] = useState("");
  const [displayName, setDisplayName] = useState("Guest");
  const [roomReady, setRoomReady] = useState(false);
  const [roomLoadError, setRoomLoadError] = useState<string | null>(null);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const pushToast = useCallback((message: string) => {
    const id = nanoid();
    setToasts((prev) => [...prev, { id, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 1800);
  }, []);

  useEffect(() => {
    const existing = localStorage.getItem("cloudcanvas-user-id");
    if (existing) {
      setUserId(existing);
    } else {
      const next = crypto.randomUUID();
      localStorage.setItem("cloudcanvas-user-id", next);
      setUserId(next);
    }
    setDisplayName(localStorage.getItem("cloudcanvas-display-name") ?? "Guest");
  }, []);

  useEffect(() => {
    if (!isValidRoomId) {
      setRoomLoadError(
        "Invalid room code. Room IDs must be 6 alphanumeric characters.",
      );
      setRoomReady(false);
      return;
    }

    let isCancelled = false;
    setRoomLoadError(null);
    setRoomReady(false);

    getRoom(roomId)
      .then(() => {
        if (!isCancelled) {
          setRoomReady(true);
        }
      })
      .catch((error: Error) => {
        if (!isCancelled) {
          setRoomLoadError(error.message || "Room unavailable.");
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [roomId, isValidRoomId]);

  const {
    participants,
    strokes,
    setStrokes,
    status,
    expired,
    error,
    hasJoined,
    setError,
  } = useRoomSocket(
    roomReady ? roomId : "",
    roomReady ? userId : "",
    displayName,
  );

  const clearBoard = () => {
    socket.emit(SOCKET_EVENTS.BOARD_CLEAR, { roomId });
    setStrokes([]);
    setIsClearModalOpen(false);
  };

  const undoMine = useCallback(() => {
    socket.emit(SOCKET_EVENTS.STROKE_UNDO, { roomId, userId });
    setStrokes((prev) => {
      const index = [...prev]
        .reverse()
        .findIndex((stroke) => stroke.userId === userId);
      if (index === -1) return prev;
      const actual = prev.length - 1 - index;
      return prev.filter((_, i) => i !== actual);
    });
  }, [roomId, userId, setStrokes]);

  const download = () => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `cloudcanvas-${roomId}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    pushToast("Download started.");
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      pushToast("Room link copied.");
    } catch {
      setError(
        "Unable to copy. Please copy the URL manually from your browser.",
      );
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
        return;

      if (event.key.toLowerCase() === "b") {
        setTool("pen");
      }
      if (event.key.toLowerCase() === "e") {
        setTool("eraser");
      }
      const isUndo =
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "z" &&
        !event.shiftKey;
      if (isUndo) {
        event.preventDefault();
        undoMine();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undoMine]);

  useEffect(() => {
    const onBoardCleared = () => {
      pushToast("Board cleared.");
    };

    socket.on(SOCKET_EVENTS.BOARD_CLEARED, onBoardCleared);
    return () => {
      socket.off(SOCKET_EVENTS.BOARD_CLEARED, onBoardCleared);
    };
  }, [pushToast]);

  if (roomLoadError || expired) {
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
  }

  return (
    <main className="min-h-screen bg-slate-50/40 px-3 py-4 sm:px-5 sm:py-6">
      <div className="mx-auto flex w-full max-w-[1520px] flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white px-4 py-3 shadow-sm sm:px-5">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              CloudCanvas Room
            </p>
            <h1 className="text-lg font-semibold text-slate-900 sm:text-xl">
              {roomId}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge className="capitalize">{status}</Badge>
            <Badge>Signed in as {displayName}</Badge>
            <SecondaryButton onClick={copyLink}>Copy room link</SecondaryButton>
          </div>
        </header>

        {error && (
          <div
            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700"
            role="alert"
            aria-live="polite"
          >
            {error}
          </div>
        )}

        <Toolbar
          tool={tool}
          setTool={setTool}
          color={color}
          setColor={setColor}
          size={size}
          setSize={setSize}
          onClear={() => setIsClearModalOpen(true)}
          onUndo={undoMine}
          onDownload={download}
          disabled={!hasJoined}
        />

        {!hasJoined && (
          <div
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm"
            role="status"
            aria-live="polite"
          >
            Connecting to room…
          </div>
        )}

        <section className="grid gap-4 xl:grid-cols-[1fr_300px]">
          <div className="relative">
            <CanvasBoard
              roomId={roomId}
              userId={userId || "pending"}
              tool={tool}
              color={color}
              size={size}
              strokes={strokes}
              setStrokes={setStrokes}
              disabled={!hasJoined}
            />
            {strokes.length === 0 && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center p-8">
                <div className="rounded-2xl border border-slate-200/80 bg-white/90 px-6 py-5 text-center shadow-sm backdrop-blur-sm">
                  <p className="text-sm font-medium text-slate-700">
                    Start sketching
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Your first stroke appears instantly for everyone in this
                    room.
                  </p>
                </div>
              </div>
            )}
          </div>
          <ParticipantsPanel participants={participants} userId={userId} />
        </section>
      </div>

      <ConfirmModal
        open={isClearModalOpen}
        title="Clear board?"
        description="This will remove all strokes for everyone currently in this room."
        confirmLabel="Clear board"
        cancelLabel="Cancel"
        destructive
        onCancel={() => setIsClearModalOpen(false)}
        onConfirm={clearBoard}
      />
      <ToastStack toasts={toasts} />
    </main>
  );
}
