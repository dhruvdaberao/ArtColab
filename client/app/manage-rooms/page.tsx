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
    <div key={room.roomId} className="flex flex-wrap items-center justify-between gap-2 rounded-[1.5rem] border-2 border-[color:var(--border)] bg-[color:var(--surface)] p-3 transition hover:-translate-y-0.5">
      <div>
        <p className="font-semibold text-[color:var(--primary)]">{room.name}</p>
        <p className="text-xs text-[color:var(--text-muted)]">Code: {room.roomId} · {room.participants} active</p>
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
      <Card className="bg-[color:var(--surface)]">
        <h2 className="text-lg font-extrabold text-[color:var(--primary)]">Owned Rooms</h2>
        {ownedRooms.length === 0 && <p className="mt-2 text-sm text-[color:var(--text-muted)]">No owned rooms yet.</p>}
        <div className="mt-3 space-y-2">{ownedRooms.map((room) => roomRow(room, true))}</div>
      </Card>
      <Card className="bg-[color:var(--surface)]">
        <h2 className="text-lg font-extrabold text-[color:var(--primary)]">Joined Rooms</h2>
        {joinedRooms.length === 0 && <p className="mt-2 text-sm text-[color:var(--text-muted)]">No joined rooms yet.</p>}
        <div className="mt-3 space-y-2">{joinedRooms.map((room) => roomRow(room, false))}</div>
      </Card>
      {editing && <Card className="bg-[color:var(--surface)]"><h3 className="font-bold text-[color:var(--primary)]">Edit Room</h3><form onSubmit={save} className="mt-2 space-y-2"><Input value={name} onChange={(e) => setName(e.target.value)} /><select className="comic-select" value={visibility} onChange={(e) => setVisibility(e.target.value as 'public' | 'private')}><option value="public">Public</option><option value="private">Private</option></select>{visibility === 'private' && <Input type="password" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} />}<div className="flex gap-2"><Button>Save</Button><SecondaryButton type="button" onClick={() => setEditing(null)}>Cancel</SecondaryButton></div></form></Card>}
      {error && <p className="status-banner status-danger">{error}</p>}
    </main>
  );
}
