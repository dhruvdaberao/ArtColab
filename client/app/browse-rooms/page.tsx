'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Clock3, Lock, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { GuestDisplayNameModal } from '@/components/guest-display-name-modal';
import { RoomPasswordModal } from '@/components/room-password-modal';
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

  const load = async (q: string) => {
    const data = await browseRooms(q);
    setRooms(data.rooms);
  };

  useEffect(() => {
    load(query).catch((e) => setError((e as Error).message));
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
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-10">
      <div className="mb-4 flex flex-wrap gap-2"><Link href="/"><SecondaryButton>Back</SecondaryButton></Link><Input placeholder="Find an Art Colab room by name" value={query} onChange={(e) => setQuery(e.target.value)} className="max-w-sm" /></div>
      {user?.role === 'guest' && <p className="mb-4 text-sm text-[color:var(--text-muted)]">Joining as <span className="font-semibold text-[color:var(--text-main)]">{resolveSessionDisplayName(user)}</span>.</p>}
      <Card className="space-y-3 bg-[color:var(--surface)]">
        <h1 className="text-2xl font-extrabold text-[color:var(--primary)]">Browse Rooms</h1>
        {rooms.length === 0 && <p className="rounded-2xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-5 text-sm text-[color:var(--text-muted)]">No rooms yet. Be the first to create a room.</p>}
        <div className="grid gap-3 md:grid-cols-2">
          {rooms.map((room) => (
            <div key={room.roomId} className="group rounded-[1.5rem] border-2 border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow)] transition duration-150 hover:-translate-y-0.5">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 text-base font-bold text-[color:var(--primary)]">{room.name} {room.visibility === 'private' && <Lock className="h-4 w-4 text-[color:var(--primary)]" />}</div>
                  <p className="text-xs text-[color:var(--text-muted)]">Owner: {room.owner?.name ?? 'Unknown'}</p>
                </div>
                <Badge className="capitalize">{room.visibility}</Badge>
              </div>
              <div className="mb-3 space-y-1 text-xs text-[color:var(--text-muted)]">
                <p className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {room.participants} participant{room.participants === 1 ? '' : 's'}</p>
                <p className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" /> Room code: {room.roomId}</p>
              </div>
              <Button onClick={() => startJoin(room).catch((e) => setError((e as Error).message))} className="w-full">Join room</Button>
            </div>
          ))}
        </div>
      </Card>
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
