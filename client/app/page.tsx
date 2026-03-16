'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { Button, Card } from '@/components/ui';
import { createRoom } from '@/lib/api';

export default function HomePage() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveDisplayName = (name: string) => {
    localStorage.setItem('cloudcanvas-display-name', name.trim() || `Guest-${Math.floor(Math.random() * 9000) + 1000}`);
  };

  const onCreate = async () => {
    setIsBusy(true);
    setError(null);
    try {
      saveDisplayName(displayName);
      const data = await createRoom();
      router.push(`/room/${data.room.roomId}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsBusy(false);
    }
  };

  const onJoin = (event: FormEvent) => {
    event.preventDefault();
    if (!roomCode.trim()) return;
    saveDisplayName(displayName);
    router.push(`/room/${roomCode.toUpperCase().trim()}`);
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 py-16">
      <section className="mb-10 space-y-3 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">CloudCanvas</p>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">Real-time collaborative drawing rooms</h1>
        <p className="mx-auto max-w-2xl text-slate-600">
          Create a temporary room and sketch with teammates instantly. Smooth multiplayer canvas, participant presence, and auto-expiring sessions.
        </p>
      </section>

      <Card className="mx-auto w-full max-w-xl space-y-4">
        <label className="block text-sm font-medium text-slate-700">
          Display name
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Guest-4821"
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-slate-200 focus:ring"
            maxLength={32}
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <Button onClick={onCreate} disabled={isBusy}>
            {isBusy ? 'Creating…' : 'Create room'}
          </Button>
          <form onSubmit={onJoin} className="flex gap-2">
            <input
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              placeholder="Room code"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 uppercase outline-none ring-slate-200 focus:ring"
              maxLength={6}
            />
            <Button type="submit">Join</Button>
          </form>
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </Card>
    </main>
  );
}
