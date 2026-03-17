'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Clock3, Lock, Users } from 'lucide-react';
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
      <div className="mb-4 flex flex-wrap gap-2"><Link href="/"><SecondaryButton>Back</SecondaryButton></Link><Input placeholder="Find a candy room by name" value={query} onChange={(e) => setQuery(e.target.value)} className="max-w-sm" /></div>
      <Card className="space-y-3">
        <h1 className="text-2xl font-extrabold text-purple-900">Browse Rooms</h1>
        {rooms.length === 0 && <p className="rounded-2xl border border-dashed border-purple-200 bg-purple-50 px-4 py-5 text-sm text-purple-600">No rooms yet. Be the first to create a doodle party ✨</p>}
        <div className="grid gap-3 md:grid-cols-2">
          {rooms.map((room) => (
            <div key={room.roomId} className="group rounded-2xl border border-pink-100 bg-white p-4 shadow-sm transition duration-150 hover:-translate-y-0.5 hover:shadow-md">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 text-base font-bold text-purple-900">{room.name} {room.visibility === 'private' && <Lock className="h-4 w-4 text-purple-500" />}</div>
                  <p className="text-xs text-purple-500">Owner: {room.owner?.name ?? 'Unknown'}</p>
                </div>
                <Badge className="capitalize">{room.visibility}</Badge>
              </div>
              <div className="mb-3 space-y-1 text-xs text-purple-600">
                <p className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {room.participants} participant{room.participants === 1 ? '' : 's'}</p>
                <p className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" /> Room code: {room.roomId}</p>
              </div>
              <Button onClick={() => room.visibility === 'public' ? joinRoom({ name: room.name, visibility: 'public' }).then((d) => router.push(`/room/${d.roomId}`)).catch((e) => setError((e as Error).message)) : setTarget(room)} className="w-full">Join room</Button>
            </div>
          ))}
        </div>
      </Card>
      {error && <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
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
