'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { InfoCardsSection } from '@/components/info-cards';
import { SiteHeader } from '@/components/site-header';
import { Badge, Button, Card, DangerButton, Input, SecondaryButton } from '@/components/ui';
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
    <div key={room.roomId} className="flex flex-col gap-3 rounded-[1.5rem] border-2 border-[color:var(--border)] bg-[color:var(--surface)] p-4 transition hover:-translate-y-0.5 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <p className="truncate font-black text-[color:var(--primary)]">{room.name}</p>
        <p className="break-all text-xs text-[color:var(--text-muted)]">🔑 {room.roomId} · 👥 {room.participants} active</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge className="capitalize">{room.visibility}</Badge>
        <Button onClick={() => router.push(`/room/${room.roomId}`)}>🎨 Open</Button>
        {owned ? <><SecondaryButton onClick={() => { setEditing(room); setName(room.name); setVisibility(room.visibility); }}>✏️ Edit</SecondaryButton><DangerButton onClick={() => deleteRoom(room.roomId).then(load).catch((e) => setError((e as Error).message))}>🗑️ Delete</DangerButton></> : <SecondaryButton onClick={() => leaveRoom(room.roomId).then(load).catch((e) => setError((e as Error).message))}>👋 Leave</SecondaryButton>}
      </div>
    </div>
  );

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl space-y-4 px-4 py-6 sm:px-6 sm:py-8">
      <SiteHeader compact />
      <Link href="/"><SecondaryButton>🏠 Back home</SecondaryButton></Link>
      <Card className="bg-[color:var(--surface)] p-5 sm:p-6">
        <h1 className="text-2xl font-black text-[color:var(--text-main)]">🛠️ Manage your Froddle rooms</h1>
        <p className="mt-2 max-w-2xl text-sm text-[color:var(--text-muted)]">Edit room details, clean up old spaces, or hop back into active rooms without changing backend behavior.</p>
      </Card>
      <Card className="bg-[color:var(--surface)] p-5 sm:p-6">
        <h2 className="text-lg font-black text-[color:var(--text-main)]">Owned rooms</h2>
        {ownedRooms.length === 0 && <p className="mt-2 text-sm text-[color:var(--text-muted)]">No owned rooms yet.</p>}
        <div className="mt-3 space-y-3">{ownedRooms.map((room) => roomRow(room, true))}</div>
      </Card>
      <Card className="bg-[color:var(--surface)] p-5 sm:p-6">
        <h2 className="text-lg font-black text-[color:var(--text-main)]">Joined rooms</h2>
        {joinedRooms.length === 0 && <p className="mt-2 text-sm text-[color:var(--text-muted)]">No joined rooms yet.</p>}
        <div className="mt-3 space-y-3">{joinedRooms.map((room) => roomRow(room, false))}</div>
      </Card>
      {editing && <Card className="bg-[color:var(--surface)] p-5 sm:p-6"><h3 className="font-black text-[color:var(--text-main)]">✏️ Edit room</h3><form onSubmit={save} className="mt-3 space-y-3"><Input value={name} onChange={(e) => setName(e.target.value)} /><select className="comic-select" value={visibility} onChange={(e) => setVisibility(e.target.value as 'public' | 'private')}><option value="public">Public</option><option value="private">Private</option></select>{visibility === 'private' && <Input type="password" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} />}<div className="flex flex-col gap-2 sm:flex-row"><Button>💾 Save</Button><SecondaryButton type="button" onClick={() => setEditing(null)}>Cancel</SecondaryButton></div></form></Card>}
      <section className="pt-2"><InfoCardsSection /></section>
      {error && <p className="status-banner status-danger">{error}</p>}
    </main>
  );
}
