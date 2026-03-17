'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { RoomPasswordModal } from '@/components/room-password-modal';
import { Badge, Button, Card, Input, SecondaryButton } from '@/components/ui';
import { browseRooms, joinRoom, type RoomListItem } from '@/lib/api';

export default function BrowseRoomsPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<RoomListItem | null>(null);

  const load = async (q: string) => {
    const data = await browseRooms(q);
    setRooms(data.rooms);
  };

  useEffect(() => {
    load(query).catch((e) => setError((e as Error).message));
  }, [query]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-10">
      <div className="mb-4 flex gap-2"><Link href="/"><SecondaryButton>Back</SecondaryButton></Link><Input placeholder="Search room name" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
      <Card className="space-y-3">
        {rooms.length === 0 && <p className="text-sm text-slate-500">No rooms found.</p>}
        {rooms.map((room) => (
          <div key={room.roomId} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
            <div>
              <div className="flex items-center gap-2 font-medium">{room.name} {room.visibility === 'private' && <Lock className="h-4 w-4" />}</div>
              <div className="text-xs text-slate-500">Owner: {room.owner?.name ?? 'Unknown'} · Participants: {room.participants}</div>
            </div>
            <div className="flex items-center gap-2"><Badge>{room.visibility}</Badge><Button onClick={() => room.visibility === 'public' ? joinRoom({ name: room.name, visibility: 'public' }).then((d) => router.push(`/room/${d.roomId}`)).catch((e) => setError((e as Error).message)) : setTarget(room)}>Join</Button></div>
          </div>
        ))}
      </Card>
      {error && <p className="mt-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
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
    </main>
  );
}
