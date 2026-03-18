'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Lock, Search, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { GuestDisplayNameModal } from '@/components/guest-display-name-modal';
import { InfoCardsSection } from '@/components/info-cards';
import { RoomPasswordModal } from '@/components/room-password-modal';
import { SiteHeader } from '@/components/site-header';
import { Badge, Button, Card, Input, SecondaryButton } from '@/components/ui';
import { browseRooms, joinRoom, type RoomListItem } from '@/lib/api';
import { getStoredDisplayName, resolveSessionDisplayName, setStoredDisplayName } from '@/lib/guest';

export default function BrowseRoomsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<RoomListItem | null>(null);
  const [showNameModal, setShowNameModal] = useState(false);
  const [pendingRoom, setPendingRoom] = useState<RoomListItem | null>(null);

  useEffect(() => {
    browseRooms(query).then((data) => setRooms(data.rooms)).catch((e) => setError((e as Error).message));
  }, [query]);

  const ensureGuestName = () => {
    if (user?.role === 'user') return true;
    if (getStoredDisplayName()) return true;
    setError('Please enter a display name before joining a room.');
    setShowNameModal(true);
    return false;
  };

  const startJoin = async (room: RoomListItem) => {
    if (!ensureGuestName()) {
      setPendingRoom(room);
      return;
    }
    setError(null);
    if (room.visibility === 'public') {
      const data = await joinRoom({ name: room.name, visibility: 'public' });
      router.push(`/room/${data.roomId}`);
      return;
    }
    setTarget(room);
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <SiteHeader compact />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/"><SecondaryButton>Back home</SecondaryButton></Link>
        {user?.role === 'guest' && <p className="text-sm text-[color:var(--text-muted)]">Joining as <span className="font-semibold text-[color:var(--text-main)]">{resolveSessionDisplayName(user)}</span>.</p>}
      </div>

      <Card className="space-y-4 bg-[color:var(--surface)] p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-black text-[color:var(--text-main)] sm:text-3xl">Browse rooms</h1>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">Search active Froddle spaces and jump in fast.</p>
          </div>
          <p className="text-sm text-[color:var(--text-muted)]">{rooms.length} room{rooms.length === 1 ? '' : 's'} available.</p>
        </div>

        <label className="block text-sm font-semibold text-[color:var(--text-main)]">
          Search rooms
          <div className="mt-2 flex items-center gap-2 rounded-[1.25rem] border-2 border-[color:var(--border)] bg-white px-3">
            <Search className="h-4 w-4 shrink-0 text-[color:var(--text-muted)]" />
            <Input placeholder="Find a Froddle room by name" value={query} onChange={(e) => setQuery(e.target.value)} className="border-0 bg-transparent px-0 shadow-none focus:shadow-none" />
          </div>
        </label>

        {rooms.length === 0 && <p className="rounded-2xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-5 text-sm text-[color:var(--text-muted)]">No matching rooms right now. Try another search or create one from the home page.</p>}

        <div className="grid gap-3 lg:grid-cols-2">
          {rooms.map((room) => (
            <div key={room.roomId} className="group flex h-full flex-col rounded-[1.5rem] border-2 border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow)] transition duration-150 hover:-translate-y-0.5">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-base font-black text-[color:var(--primary)]">{room.name} {room.visibility === 'private' && <Lock className="h-4 w-4 text-[color:var(--primary)]" />}</div>
                  <p className="text-xs text-[color:var(--text-muted)]">Owner: {room.owner?.name ?? 'Unknown'}</p>
                </div>
                <Badge className="capitalize">{room.visibility}</Badge>
              </div>
              <div className="mb-4 grid gap-2 text-xs text-[color:var(--text-muted)] sm:grid-cols-2">
                <p className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {room.participants} participant{room.participants === 1 ? '' : 's'}</p>
                <p className="inline-flex items-center gap-1 break-all">🔑 Room code: {room.roomId}</p>
              </div>
              <Button onClick={() => startJoin(room).catch((e) => setError((e as Error).message))} className="mt-auto w-full">Join room</Button>
            </div>
          ))}
        </div>
      </Card>

      <section className="mt-6">
        <InfoCardsSection />
      </section>

      {error && <p className="status-banner status-danger mt-3">{error}</p>}
      <RoomPasswordModal
        open={Boolean(target)}
        roomName={target?.name ?? ''}
        onCancel={() => setTarget(null)}
        onSubmit={async (password) => {
          if (!target) return;
          const data = await joinRoom({ name: target.name, visibility: 'private', password });
          router.push(`/room/${data.roomId}`);
        }}
      />
      <GuestDisplayNameModal
        open={showNameModal && user?.role === 'guest'}
        initialValue={getStoredDisplayName()}
        confirmLabel="Save name"
        onCancel={() => { setShowNameModal(false); setPendingRoom(null); }}
        onConfirm={async (name) => {
          setStoredDisplayName(name);
          setError(null);
          setShowNameModal(false);
          if (pendingRoom) {
            const room = pendingRoom;
            setPendingRoom(null);
            await startJoin(room);
          }
        }}
      />
    </main>
  );
}
