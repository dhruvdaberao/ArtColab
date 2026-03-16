'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CanvasBoard } from '@/components/canvas-board';
import { ParticipantsPanel } from '@/components/participants-panel';
import { Toolbar } from '@/components/toolbar';
import { Button } from '@/components/ui';
import { socket } from '@/lib/socket';
import { useRoomSocket } from '@/hooks/use-room-socket';
import type { DrawingTool } from '@cloudcanvas/shared';

export default function RoomPage() {
  const params = useParams<{ roomId: string }>();
  const router = useRouter();
  const roomId = params.roomId.toUpperCase();
  const [tool, setTool] = useState<DrawingTool>('pen');
  const [color, setColor] = useState('#111827');
  const [size, setSize] = useState(4);
  const [userId, setUserId] = useState('');
  const [displayName, setDisplayName] = useState('Guest');

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

  const { participants, strokes, setStrokes, status, expired } = useRoomSocket(roomId, userId, displayName);

  const clearBoard = () => {
    if (confirm('Clear the full board for everyone?')) {
      socket.emit('clear_board', { roomId });
      setStrokes([]);
    }
  };

  const undoMine = () => {
    socket.emit('undo_stroke', { roomId, userId });
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
    await navigator.clipboard.writeText(window.location.href);
    alert('Room link copied');
  };

  if (expired) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-semibold">Room expired</h1>
          <p className="mt-2 text-slate-600">This temporary room is no longer active.</p>
          <Button className="mt-4" onClick={() => router.push('/')}>
            Create a new room
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 lg:p-6">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">CloudCanvas Room</p>
            <h1 className="text-xl font-semibold text-slate-900">{roomId}</h1>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{status}</span>
            <Button onClick={copyLink}>Share</Button>
          </div>
        </header>

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

        <section className="grid gap-4 lg:grid-cols-[1fr_260px]">
          <CanvasBoard roomId={roomId} userId={userId || 'pending'} tool={tool} color={color} size={size} strokes={strokes} setStrokes={setStrokes} />
          <ParticipantsPanel participants={participants} />
        </section>
      </div>
    </main>
  );
}
