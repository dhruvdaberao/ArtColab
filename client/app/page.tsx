'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useMemo, useState } from 'react';
import { Button, Card, Input, SecondaryButton } from '@/components/ui';
import { createRoom } from '@/lib/api';

const getDefaultName = () => `Guest-${Math.floor(Math.random() * 9000) + 1000}`;

const SparkIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M12 3v4M12 17v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M3 12h4M17 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
  </svg>
);

const ArrowIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

export default function HomePage() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedCode = useMemo(() => roomCode.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase(), [roomCode]);

  const saveDisplayName = (name: string) => {
    localStorage.setItem('cloudcanvas-display-name', name.trim() || getDefaultName());
  };

  const onCreate = async () => {
    setIsCreating(true);
    setError(null);
    try {
      saveDisplayName(displayName);
      const data = await createRoom();
      router.push(`/room/${data.room.roomId}`);
    } catch (err) {
      setError((err as Error).message || 'Unable to create room. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const onJoin = async (event: FormEvent) => {
    event.preventDefault();
    if (!normalizedCode) return;
    setIsJoining(true);
    setError(null);
    saveDisplayName(displayName);
    router.push(`/room/${normalizedCode}`);
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-4 py-14 sm:px-8">
      <section className="mb-10 space-y-4 text-center sm:mb-12">
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">CloudCanvas</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-5xl">A premium collaborative whiteboard</h1>
        <p className="mx-auto max-w-2xl text-sm text-slate-600 sm:text-base">
          Start a room in seconds, sketch with your team in real time, and keep every interaction calm, clear, and professional.
        </p>
      </section>

      <Card className="mx-auto w-full max-w-4xl space-y-6 p-5 sm:p-8">
        <label className="block text-sm font-medium text-slate-700">
          Display name
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={getDefaultName()} maxLength={32} className="mt-2" />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-slate-200/90 bg-slate-50/65 p-5 shadow-none">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm">
                <SparkIcon />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Create room</h2>
                <p className="text-xs text-slate-500">Generate a secure session instantly.</p>
              </div>
            </div>
            <Button onClick={onCreate} disabled={isCreating || isJoining} className="w-full gap-2">
              {isCreating ? 'Creating room…' : 'Create new room'}
            </Button>
          </Card>

          <Card className="border-slate-200/90 bg-slate-50/65 p-5 shadow-none">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm">
                <ArrowIcon />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Join room</h2>
                <p className="text-xs text-slate-500">Enter a 6-character room code.</p>
              </div>
            </div>
            <form onSubmit={onJoin} className="flex gap-2">
              <Input
                value={normalizedCode}
                onChange={(e) => setRoomCode(e.target.value)}
                placeholder="ABC123"
                className="uppercase tracking-[0.14em]"
                maxLength={6}
              />
              <SecondaryButton type="submit" disabled={!normalizedCode || isCreating || isJoining}>
                {isJoining ? 'Joining…' : 'Join'}
              </SecondaryButton>
            </form>
          </Card>
        </div>

        <p className="text-xs text-slate-500">Tip: after creating a room, share your invite link directly from the room header.</p>
        {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      </Card>
    </main>
  );
}
