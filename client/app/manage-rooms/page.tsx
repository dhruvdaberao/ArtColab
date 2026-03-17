'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { Button, Card, Input, SecondaryButton } from '@/components/ui';
import { deleteRoom, getManageRooms, leaveRoom, updateRoomSettings, type RoomListItem } from '@/lib/api';

export default function ManageRoomsPage() {
  const router = useRouter();
  const [ownedRooms, setOwnedRooms] = useState<RoomListItem[]>([]);
  const [joinedRooms, setJoinedRooms] = useState<RoomListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<RoomListItem | null>(null);
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [password, setPassword] = useState('');

  const load = async () => {
    const data = await getManageRooms();
    setOwnedRooms(data.ownedRooms);
    setJoinedRooms(data.joinedRooms);
  };

  useEffect(() => {
    load().catch((e) => setError((e as Error).message));
  }, []);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    await updateRoomSettings(editing.roomId, { name, visibility, password: visibility === 'private' ? password : undefined });
    setEditing(null);
    setPassword('');
    await load();
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-10 space-y-4">
      <Link href="/"><SecondaryButton>Back</SecondaryButton></Link>
      <Card>
        <h2 className="text-lg font-semibold">Owned Rooms</h2>
        {ownedRooms.length === 0 && <p className="text-sm text-slate-500 mt-2">No owned rooms.</p>}
        <div className="mt-3 space-y-2">
          {ownedRooms.map((room) => <div key={room.roomId} className="flex items-center justify-between rounded-xl border border-slate-200 p-3"><span>{room.name}</span><div className="flex gap-2"><Button onClick={() => router.push(`/room/${room.roomId}`)}>Open</Button><SecondaryButton onClick={() => { setEditing(room); setName(room.name); setVisibility(room.visibility); }}>Edit</SecondaryButton><SecondaryButton onClick={() => deleteRoom(room.roomId).then(load).catch((e) => setError((e as Error).message))}>Delete</SecondaryButton></div></div>)}
        </div>
      </Card>
      <Card>
        <h2 className="text-lg font-semibold">Joined Rooms</h2>
        {joinedRooms.length === 0 && <p className="text-sm text-slate-500 mt-2">No joined rooms.</p>}
        <div className="mt-3 space-y-2">
          {joinedRooms.map((room) => <div key={room.roomId} className="flex items-center justify-between rounded-xl border border-slate-200 p-3"><span>{room.name}</span><div className="flex gap-2"><Button onClick={() => router.push(`/room/${room.roomId}`)}>Open</Button><SecondaryButton onClick={() => leaveRoom(room.roomId).then(load).catch((e) => setError((e as Error).message))}>Leave</SecondaryButton></div></div>)}
        </div>
      </Card>
      {editing && <Card><h3 className="font-semibold">Edit Room</h3><form onSubmit={save} className="mt-2 space-y-2"><Input value={name} onChange={(e) => setName(e.target.value)} /><select className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" value={visibility} onChange={(e) => setVisibility(e.target.value as 'public' | 'private')}><option value="public">Public</option><option value="private">Private</option></select>{visibility === 'private' && <Input type="password" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} />}<div className="flex gap-2"><Button>Save</Button><SecondaryButton type="button" onClick={() => setEditing(null)}>Cancel</SecondaryButton></div></form></Card>}
      {error && <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
    </main>
  );
}
