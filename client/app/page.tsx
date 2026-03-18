'use client';

import frogLogo from '../../frog-logo.png';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
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

  const ensureDisplayName = (action: 'create' | 'join') => {
    if (user?.role === 'user') return user.username;
    const normalized = displayName.trim() || getStoredDisplayName();
    if (normalized) {
      setDisplayName(normalized);
      persistDisplayName(normalized);
      return normalized;
    }
    setPendingAction(action);
    return null;
  };

  const onCreate = async (event: FormEvent) => {
    event.preventDefault();
    const sessionName = ensureDisplayName('create');
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
    const normalized = ensureDisplayName('join');
    if (!normalized) {
      setError('Please enter a display name before joining a room.');
      return;
    }
    setDisplayName(normalized);
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

  if (loading) return <main className="grid min-h-screen place-items-center text-lg font-semibold text-[color:var(--text-main)]">Loading Froddle…</main>;

  if (!user) {
    return <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-8 sm:px-6 lg:px-8"><div className="grid w-full gap-6 lg:grid-cols-[1.15fr_0.85fr]"><Card className="brand-panel space-y-5 overflow-hidden bg-[color:var(--bg-elevated)] p-6 sm:p-8"><Image src={frogLogo} alt="Froddle" priority className="h-auto w-full max-w-[220px]" /><p className="max-w-2xl text-sm leading-6 text-[color:var(--text-muted)] sm:text-base">Froddle is a lively, collaborative canvas for friends, teams, and sketch-happy groups. Jump in instantly, doodle together, and keep the energy organized instead of chaotic.</p><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-[1.5rem] border-2 border-[color:var(--border)] bg-white/80 p-4"><p className="font-bold text-[color:var(--text-main)]">Instant guest mode</p><p className="mt-1 text-sm text-[color:var(--text-muted)]">Hop into a room fast without slowing down the creative flow.</p></div><div className="rounded-[1.5rem] border-2 border-[color:var(--border)] bg-white/80 p-4"><p className="font-bold text-[color:var(--text-main)]">Account perks</p><p className="mt-1 text-sm text-[color:var(--text-muted)]">Save your profile, room history, and password recovery settings.</p></div><div className="rounded-[1.5rem] border-2 border-[color:var(--border)] bg-white/80 p-4"><p className="font-bold text-[color:var(--text-main)]">Realtime teamwork</p><p className="mt-1 text-sm text-[color:var(--text-muted)]">Stay synced while drawing, chatting, reacting, and sharing ideas.</p></div></div></Card><Card className="space-y-4 bg-[color:var(--surface)] p-5 sm:p-6"><p className="text-sm font-semibold text-[color:var(--text-muted)]">Choose how you want to hop in.</p><Button className="w-full" onClick={() => router.push('/auth?view=register')}>Create account <ArrowRight className="h-4 w-4" /></Button><SecondaryButton className="w-full" onClick={() => router.push('/auth?view=login')}>Login</SecondaryButton><Button className="w-full bg-[color:var(--brand-green)] hover:bg-[color:var(--brand-green-strong)]" disabled={isGuesting} onClick={() => { setIsGuesting(true); setError(null); loginAsGuest().catch((e) => setError((e as Error).message)).finally(() => setIsGuesting(false)); }}>{isGuesting ? 'Starting guest session…' : 'Continue as guest'}</Button>{error && <p className="status-banner status-danger">{error}</p>}</Card></div></main>;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <header className="mb-6 flex items-start justify-between gap-3 sm:items-center">
        <Link href="/" aria-label="Froddle home" className="min-w-0 shrink">
          <Image src={frogLogo} alt="Froddle" priority className="h-auto w-full max-w-[140px] sm:max-w-[180px] lg:max-w-[220px]" />
        </Link>
        <div className="shrink-0 self-start">
          <UserAvatarMenu />
        </div>
      </header>

      {error && <p className="mb-4 status-banner status-danger">{error}</p>}

      <section className="mb-5 flex flex-wrap gap-3">
        <Link href="/browse-rooms"><SecondaryButton className="w-full sm:w-auto">Browse rooms</SecondaryButton></Link>
        <Link href="/manage-rooms"><SecondaryButton className="w-full sm:w-auto">Manage rooms</SecondaryButton></Link>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="space-y-3 bg-[color:var(--surface)] p-5 sm:p-6"><h2 className="text-xl font-bold text-[color:var(--text-main)]">Create room</h2><p className="text-sm text-[color:var(--text-muted)]">Launch a fresh creative space for sketches, brainstorms, and shared experiments.</p><form className="space-y-3" onSubmit={onCreate}><Input placeholder="Room name" value={createName} onChange={(e) => setCreateName(e.target.value)} required /><select className="comic-select" value={createVisibility} onChange={(e) => setCreateVisibility(e.target.value as 'public' | 'private')}><option value="public">Public</option><option value="private">Private</option></select>{createVisibility === 'private' && <Input type="password" placeholder="Room password" value={createPassword} onChange={(e) => setCreatePassword(e.target.value)} /> }<Button type="submit" disabled={isCreating || isJoining} className="w-full">{isCreating ? 'Creating room…' : 'Create room'}</Button></form></Card>
        <Card className="space-y-3 bg-[color:var(--surface)] p-5 sm:p-6"><h2 className="text-xl font-bold text-[color:var(--text-main)]">Join room</h2><p className="text-sm text-[color:var(--text-muted)]">Rejoin your crew with a room name and hop back into the shared board.</p><form className="space-y-3" onSubmit={onJoin}><Input placeholder="Room name" value={joinName} onChange={(e) => setJoinName(e.target.value)} required /><select className="comic-select" value={joinVisibility} onChange={(e) => setJoinVisibility(e.target.value as 'public' | 'private')}><option value="public">Public</option><option value="private">Private</option></select>{joinVisibility === 'private' && <Input type="password" placeholder="Room password" value={joinPassword} onChange={(e) => setJoinPassword(e.target.value)} /> }<Button type="submit" disabled={isCreating || isJoining} className="w-full bg-[color:var(--brand-green)] hover:bg-[color:var(--brand-green-strong)]">{isJoining ? 'Joining room…' : 'Join room'}</Button></form></Card>
      </section>

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
