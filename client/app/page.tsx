'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { Palette } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { GuestDisplayNameModal } from '@/components/guest-display-name-modal';
import { UserAvatarMenu } from '@/components/user-avatar-menu';
import { Button, Card, Input, SecondaryButton } from '@/components/ui';
import { createRoom, joinRoom } from '@/lib/api';
import { getStoredDisplayName, resolveSessionDisplayName, setStoredDisplayName } from '@/lib/guest';

export default function HomePage() {
  const router = useRouter();
  const { user, loading, loginAsGuest } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [createName, setCreateName] = useState('');
  const [createVisibility, setCreateVisibility] = useState<'public' | 'private'>('public');
  const [createPassword, setCreatePassword] = useState('');
  const [joinName, setJoinName] = useState('');
  const [joinVisibility, setJoinVisibility] = useState<'public' | 'private'>('public');
  const [joinPassword, setJoinPassword] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isGuesting, setIsGuesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<'create' | 'join' | null>(null);

  useEffect(() => {
    if (user) {
      setDisplayName(resolveSessionDisplayName(user));
    }
  }, [user]);

  const persistDisplayName = (name: string) => {
    const normalized = name.trim();
    if (user?.role === 'user') return user.username;
    return setStoredDisplayName(normalized);
  };

  const ensureDisplayName = () => {
    if (user?.role === 'user') return user.username;
    const normalized = displayName.trim() || getStoredDisplayName();
    if (normalized) {
      setDisplayName(normalized);
      persistDisplayName(normalized);
      return normalized;
    }
    setPendingAction('create');
    return null;
  };

  const onCreate = async (event: FormEvent) => {
    event.preventDefault();
    const sessionName = ensureDisplayName();
    if (!sessionName) {
      setError('Please enter a display name before creating a room.');
      return;
    }
    setIsCreating(true);
    setError(null);
    try {
      const data = await createRoom({
        name: createName.trim(),
        visibility: createVisibility,
        password: createVisibility === 'private' ? createPassword : undefined,
        guestDisplayName: user?.role === 'guest' ? sessionName : undefined
      });
      router.push(`/room/${data.room.roomId}`);
    } catch (err) {
      setError((err as Error).message || 'Unable to create room.');
    } finally {
      setIsCreating(false);
    }
  };

  const onJoin = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = user?.role === 'user' ? user.username : displayName.trim() || getStoredDisplayName();
    if (!normalized) {
      setPendingAction('join');
      setError('Please enter a display name before joining a room.');
      return;
    }
    setDisplayName(normalized);
    persistDisplayName(normalized);
    setIsJoining(true);
    setError(null);
    try {
      const data = await joinRoom({
        name: joinName.trim(),
        visibility: joinVisibility,
        password: joinVisibility === 'private' ? joinPassword : undefined,
        guestDisplayName: user?.role === 'guest' ? normalized : undefined
      });
      router.push(`/room/${data.roomId}`);
    } catch (err) {
      setError((err as Error).message || 'Unable to join room.');
    } finally {
      setIsJoining(false);
    }
  };

  if (loading) return <main className="grid min-h-screen place-items-center text-lg font-semibold text-[color:var(--text-main)]">Loading Art Colab…</main>;

  if (!user) {
    return <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-4 py-10"><div className="grid w-full gap-6 md:grid-cols-[1.1fr_0.9fr]"><Card className="space-y-4 bg-[color:var(--bg-elevated)]"><p className="inline-flex items-center rounded-full border-2 border-[color:var(--border)] bg-[color:var(--accent)] px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--text-main)]">Realtime creative rooms</p><h1 className="text-4xl font-black leading-tight text-[color:var(--text-main)]">Art Colab</h1><p className="max-w-md text-sm text-[color:var(--text-muted)]">A clean shared canvas for teams and friends. Draw together, stay synced, and move fast.</p><div className="rounded-[1.5rem] border-2 border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4 text-sm font-medium text-[color:var(--text-main)]">Guest mode stays instant. Account mode gives you profile, room history, and password recovery.</div></Card><Card className="space-y-4 bg-[color:var(--surface)]"><Button className="w-full" onClick={() => router.push('/auth?view=register')}>Create account</Button><SecondaryButton className="w-full" onClick={() => router.push('/auth?view=login')}>Login</SecondaryButton><SecondaryButton className="w-full" disabled={isGuesting} onClick={() => { setIsGuesting(true); setError(null); loginAsGuest().catch((e) => setError((e as Error).message)).finally(() => setIsGuesting(false)); }}>{isGuesting ? 'Starting guest session…' : 'Continue as guest'}</SecondaryButton>{error && <p className="status-banner status-danger">{error}</p>}</Card></div></main>;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-8 sm:px-8">
      <div className="mb-5 flex items-center justify-between gap-3"><div className="inline-flex items-center gap-2 rounded-full border-2 border-[color:var(--border)] bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-[color:var(--text-main)]"><Palette className="h-4 w-4" /> Art Colab Workspace</div><UserAvatarMenu /></div>
      <Card className="space-y-6 bg-[color:var(--surface)]"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-3xl font-black text-[color:var(--text-main)]">Welcome back, {resolveSessionDisplayName(user)}</h1><p className="text-sm text-[color:var(--text-muted)]">Create a room, join one, or manage your existing spaces.</p></div><div className="flex flex-wrap gap-2"><Link href="/browse-rooms"><SecondaryButton>Browse rooms</SecondaryButton></Link><Link href="/manage-rooms"><SecondaryButton>Manage rooms</SecondaryButton></Link></div></div>
        <label className="block text-sm font-semibold text-[color:var(--text-main)]">Display name for this session<Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="mt-1" placeholder={resolveSessionDisplayName(user)} disabled={user.role === 'user'} /></label>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="space-y-3 bg-[color:var(--surface)]"><h2 className="text-xl font-bold text-[color:var(--text-main)]">Create room</h2><form className="space-y-3" onSubmit={onCreate}><Input placeholder="Room name" value={createName} onChange={(e) => setCreateName(e.target.value)} required /><select className="comic-select" value={createVisibility} onChange={(e) => setCreateVisibility(e.target.value as 'public' | 'private')}><option value="public">Public</option><option value="private">Private</option></select>{createVisibility === 'private' && <Input type="password" placeholder="Room password" value={createPassword} onChange={(e) => setCreatePassword(e.target.value)} /> }<Button type="submit" disabled={isCreating || isJoining} className="w-full">{isCreating ? 'Creating room…' : 'Create room'}</Button></form></Card>
          <Card className="space-y-3 bg-[color:var(--surface)]"><h2 className="text-xl font-bold text-[color:var(--text-main)]">Join room</h2><form className="space-y-3" onSubmit={onJoin}><Input placeholder="Room name" value={joinName} onChange={(e) => setJoinName(e.target.value)} required /><select className="comic-select" value={joinVisibility} onChange={(e) => setJoinVisibility(e.target.value as 'public' | 'private')}><option value="public">Public</option><option value="private">Private</option></select>{joinVisibility === 'private' && <Input type="password" placeholder="Room password" value={joinPassword} onChange={(e) => setJoinPassword(e.target.value)} /> }<Button type="submit" disabled={isCreating || isJoining} className="w-full">{isJoining ? 'Joining room…' : 'Join room'}</Button></form></Card>
        </div>
        {error && <p className="status-banner status-danger">{error}</p>}
      </Card>
      <GuestDisplayNameModal
        open={pendingAction !== null && user.role === 'guest'}
        initialValue={displayName}
        confirmLabel={pendingAction === 'join' ? 'Save and join' : 'Save and create'}
        onCancel={() => setPendingAction(null)}
        onConfirm={(name) => {
          persistDisplayName(name);
          setDisplayName(name);
          setError(null);
          setPendingAction(null);
        }}
      />
    </main>
  );
}
