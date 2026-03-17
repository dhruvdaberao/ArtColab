'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { Badge, Button, Card, Input, SecondaryButton } from '@/components/ui';
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

  const roomRow = (room: RoomListItem, owned: boolean) => (
    <div key={room.roomId} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-fuchsia-100 bg-white p-3 transition hover:shadow-sm">
      <div>
        <p className="font-semibold text-purple-900">{room.name}</p>
        <p className="text-xs text-purple-500">Code: {room.roomId} · {room.participants} active</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge className="capitalize">{room.visibility}</Badge>
        <Button onClick={() => router.push(`/room/${room.roomId}`)}>Open</Button>
        {owned ? <><SecondaryButton onClick={() => { setEditing(room); setName(room.name); setVisibility(room.visibility); }}>Edit</SecondaryButton><SecondaryButton onClick={() => deleteRoom(room.roomId).then(load).catch((e) => setError((e as Error).message))}>Delete</SecondaryButton></> : <SecondaryButton onClick={() => leaveRoom(room.roomId).then(load).catch((e) => setError((e as Error).message))}>Leave</SecondaryButton>}
      </div>
    </div>
  );

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl space-y-4 px-4 py-10">
      <Link href="/"><SecondaryButton>Back</SecondaryButton></Link>
      <Card>
        <h2 className="text-lg font-extrabold text-purple-900">Owned Rooms</h2>
        {ownedRooms.length === 0 && <p className="mt-2 text-sm text-purple-500">No owned rooms yet.</p>}
        <div className="mt-3 space-y-2">{ownedRooms.map((room) => roomRow(room, true))}</div>
      </Card>
      <Card>
        <h2 className="text-lg font-extrabold text-purple-900">Joined Rooms</h2>
        {joinedRooms.length === 0 && <p className="mt-2 text-sm text-purple-500">No joined rooms yet.</p>}
        <div className="mt-3 space-y-2">{joinedRooms.map((room) => roomRow(room, false))}</div>
      </Card>
      {editing && <Card><h3 className="font-bold text-purple-900">Edit Room</h3><form onSubmit={save} className="mt-2 space-y-2"><Input value={name} onChange={(e) => setName(e.target.value)} /><select className="candy-input" value={visibility} onChange={(e) => setVisibility(e.target.value as 'public' | 'private')}><option value="public">Public</option><option value="private">Private</option></select>{visibility === 'private' && <Input type="password" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} />}<div className="flex gap-2"><Button>Save</Button><SecondaryButton type="button" onClick={() => setEditing(null)}>Cancel</SecondaryButton></div></form></Card>}
      {error && <p className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
    </main>
  );
}
