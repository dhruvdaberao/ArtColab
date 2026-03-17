'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { SOCKET_EVENTS } from '@cloudcanvas/shared';
import type { DrawingTool } from '@cloudcanvas/shared';
import { CanvasBoard } from '@/components/canvas-board';
import { ParticipantsPanel } from '@/components/participants-panel';
import { Toolbar } from '@/components/toolbar';
import { Badge, Button, Card, SecondaryButton } from '@/components/ui';
import { socket } from '@/lib/socket';
import { useRoomSocket } from '@/hooks/use-room-socket';
import { getRoom } from '@/lib/api';

export default function RoomPage() {
  const params = useParams<{ roomId: string }>();
  const router = useRouter();
  const roomId = useMemo(() => params.roomId.toUpperCase(), [params.roomId]);
  const isValidRoomId = /^[A-Z0-9]{6}$/.test(roomId);
  const [tool, setTool] = useState<DrawingTool>('pen');
  const [color, setColor] = useState('#0f172a');
  const [size, setSize] = useState(4);
  const [userId, setUserId] = useState('');
  const [displayName, setDisplayName] = useState('Guest');
  const [shareLabel, setShareLabel] = useState('Share');
  const [roomReady, setRoomReady] = useState(false);
  const [roomLoadError, setRoomLoadError] = useState<string | null>(null);

  useEffect(() => {
    const existing = localStorage.getItem('cloudcanvas-user-id');
    if (existing) {
      setUserId(existing);
    } else {
      const next = crypto.randomUUID();
      localStorage.setItem('cloudcanvas-user-id', next);
      setUserId(next);
    }
    setDisplayName(localStorage.getItem('cloudcanvas-display-name') ?? 'Guest');
  }, []);

  useEffect(() => {
    if (!isValidRoomId) {
      setRoomLoadError('Invalid room code. Room IDs must be 6 alphanumeric characters.');
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
          setRoomLoadError(error.message || 'Room unavailable.');
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [roomId, isValidRoomId]);

  const { participants, strokes, setStrokes, status, expired, error, hasJoined, setError } = useRoomSocket(
    roomReady ? roomId : '',
    roomReady ? userId : '',
    displayName
  );

  const clearBoard = () => {
    if (window.confirm('Clear the board for everyone in this room?')) {
      socket.emit(SOCKET_EVENTS.BOARD_CLEAR, { roomId });
      setStrokes([]);
    }
  };

  const undoMine = () => {
    socket.emit(SOCKET_EVENTS.STROKE_UNDO, { roomId, userId });
    setStrokes((prev) => {
      const index = [...prev].reverse().findIndex((stroke) => stroke.userId === userId);
      if (index === -1) return prev;
      const actual = prev.length - 1 - index;
      return prev.filter((_, i) => i !== actual);
    });
  };

  const download = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `cloudcanvas-${roomId}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareLabel('Copied');
      setTimeout(() => setShareLabel('Share'), 1400);
    } catch {
      setError('Unable to copy. Please copy the URL manually from your browser.');
    }
  };

  if (roomLoadError || expired) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <Card className="max-w-md space-y-3 p-8 text-center">
          <h1 className="text-2xl font-semibold">Room unavailable</h1>
          <p className="text-slate-600">{roomLoadError || 'This temporary room is no longer active.'}</p>
          <Button className="mt-2" onClick={() => router.push('/')}>
            Go to home
          </Button>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-3 py-4 sm:px-5 sm:py-6">
      <div className="mx-auto flex w-full max-w-[1520px] flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white px-4 py-3 shadow-sm sm:px-5">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">CloudCanvas Room</p>
            <h1 className="text-lg font-semibold text-slate-900 sm:text-xl">{roomId}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge className="capitalize">{status}</Badge>
            <Badge>Signed in as {displayName}</Badge>
            <SecondaryButton onClick={copyLink}>{shareLabel}</SecondaryButton>
          </div>
        </header>

        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>}

        <Toolbar
          tool={tool}
          setTool={setTool}
          color={color}
          setColor={setColor}
          size={size}
          setSize={setSize}
          onClear={clearBoard}
          onUndo={undoMine}
          onDownload={download}
        />

        {!hasJoined && <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">Connecting to room…</div>}

        <section className="grid gap-4 xl:grid-cols-[1fr_300px]">
          <div className="relative">
            <CanvasBoard roomId={roomId} userId={userId || 'pending'} tool={tool} color={color} size={size} strokes={strokes} setStrokes={setStrokes} />
            {strokes.length === 0 && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center p-8">
                <div className="rounded-2xl border border-slate-200/80 bg-white/90 px-6 py-5 text-center shadow-sm backdrop-blur-sm">
                  <p className="text-sm font-medium text-slate-700">Start sketching</p>
                  <p className="mt-1 text-xs text-slate-500">Your first stroke appears instantly for everyone in this room.</p>
                </div>
              </div>
            )}
          </div>
          <ParticipantsPanel participants={participants} userId={userId} />
        </section>
      </div>
    </main>
  );
}
