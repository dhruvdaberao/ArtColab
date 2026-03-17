'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { Palette } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { UserAvatarMenu } from '@/components/user-avatar-menu';
import { Button, Card, Input, SecondaryButton } from '@/components/ui';
import { createRoom, joinRoom, requestResetCode, verifyResetCode } from '@/lib/api';

type EntryView = 'entry' | 'login' | 'register' | 'forgot-request' | 'forgot-verify';

export default function HomePage() {
  const router = useRouter();
  const { user, loading, loginAsGuest, login, register } = useAuth();
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
  const [view, setView] = useState<EntryView>('entry');
  const [emailForReset, setEmailForReset] = useState('');

  const saveDisplayName = (name: string) => {
    const fallback = user?.username || `Guest-${Math.floor(Math.random() * 9000) + 1000}`;
    localStorage.setItem('cloudcanvas-display-name', name.trim() || fallback);
  };

  const onCreate = async (event: FormEvent) => {
    event.preventDefault();
    setIsCreating(true);
    setError(null);
    try {
      saveDisplayName(displayName);
      const data = await createRoom({ name: createName.trim(), visibility: createVisibility, password: createVisibility === 'private' ? createPassword : undefined });
      router.push(`/room/${data.room.roomId}`);
    } catch (err) {
      setError((err as Error).message || 'Unable to create room.');
    } finally {
      setIsCreating(false);
    }
  };

  const onJoin = async (event: FormEvent) => {
    event.preventDefault();
    setIsJoining(true);
    setError(null);
    try {
      saveDisplayName(displayName);
      const data = await joinRoom({ name: joinName.trim(), visibility: joinVisibility, password: joinVisibility === 'private' ? joinPassword : undefined });
      router.push(`/room/${data.roomId}`);
    } catch (err) {
      setError((err as Error).message || 'Unable to join room.');
    } finally {
      setIsJoining(false);
    }
  };

  if (loading) return <main className="grid min-h-screen place-items-center text-lg font-semibold text-gray-800">Loading ArtColab…</main>;

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-10">
        <Card className="w-full space-y-4">
          <div className="space-y-1 text-center">
            <p className="inline-flex items-center rounded-full border-2 border-black bg-[#fef3c7] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-black">Collaborative canvas</p>
            <h1 className="text-3xl font-black text-gray-900">ArtColab</h1>
            <p className="text-sm text-gray-600">Minimal, real-time drawing rooms for teams and friends.</p>
          </div>
          {view === 'entry' && (
            <div className="space-y-3">
              <Button className="w-full" onClick={() => setView('register')}>Create account</Button>
              <SecondaryButton className="w-full" onClick={() => setView('login')}>Login</SecondaryButton>
              <SecondaryButton className="w-full" disabled={isGuesting} onClick={() => {
                setIsGuesting(true);
                setError(null);
                loginAsGuest().catch((e) => setError((e as Error).message)).finally(() => setIsGuesting(false));
              }}>{isGuesting ? 'Starting guest session…' : 'Continue as guest'}</SecondaryButton>
            </div>
          )}
          {view === 'login' && <LoginForm onSubmit={login} onBack={() => setView('entry')} onForgot={() => setView('forgot-request')} setError={setError} />}
          {view === 'register' && <RegisterForm onSubmit={register} onBack={() => setView('entry')} setError={setError} />}
          {view === 'forgot-request' && (
            <ForgotRequest
              onBack={() => setView('login')}
              setError={setError}
              onSent={(email) => {
                setEmailForReset(email);
                setView('forgot-verify');
              }}
            />
          )}
          {view === 'forgot-verify' && <ForgotVerify email={emailForReset} onBack={() => setView('login')} setError={setError} />}
          {error && <p className="rounded-xl border-2 border-black bg-[#fee2e2] px-3 py-2 text-sm text-red-700">{error}</p>}
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-8 sm:px-8">
      <div className="mb-4 flex items-center justify-between">
        <div className="inline-flex items-center gap-2 rounded-full border-2 border-black bg-[#fef3c7] px-4 py-2 text-sm font-semibold text-black">
          <Palette className="h-4 w-4" /> ArtColab Workspace
        </div>
        <UserAvatarMenu />
      </div>
      <Card className="space-y-6 p-5 sm:p-8">
        <div className="grid gap-3 rounded-2xl border-2 border-black bg-[#f9fafb] p-4 sm:flex sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Create or join a drawing room</h2>
            <p className="text-sm text-gray-600">Invite collaborators and draw live with synced canvas state.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/browse-rooms"><SecondaryButton>Browse rooms</SecondaryButton></Link>
            <Link href="/manage-rooms"><SecondaryButton>Manage rooms</SecondaryButton></Link>
            <Link href="/profile"><SecondaryButton>Profile</SecondaryButton></Link>
          </div>
        </div>
        <label className="block text-sm font-semibold text-gray-800">
          Display name inside rooms
          <Input className="mt-1" placeholder={user.username} value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={32} />
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-5 shadow-none">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Create room</h2>
            <form onSubmit={onCreate} className="space-y-2">
              <Input placeholder="Room name" value={createName} onChange={(e) => setCreateName(e.target.value)} maxLength={48} />
              <select className="comic-input" value={createVisibility} onChange={(e) => setCreateVisibility(e.target.value as 'public' | 'private')}>
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
              {createVisibility === 'private' && <Input type="password" placeholder="Room password" value={createPassword} onChange={(e) => setCreatePassword(e.target.value)} />}
              <Button disabled={isCreating || isJoining} className="w-full">{isCreating ? 'Creating room…' : 'Create and enter'}</Button>
            </form>
          </Card>
          <Card className="p-5 shadow-none">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Join room</h2>
            <form onSubmit={onJoin} className="space-y-2">
              <Input placeholder="Room name" value={joinName} onChange={(e) => setJoinName(e.target.value)} maxLength={48} />
              <select className="comic-input" value={joinVisibility} onChange={(e) => setJoinVisibility(e.target.value as 'public' | 'private')}>
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
              {joinVisibility === 'private' && <Input type="password" placeholder="Room password" value={joinPassword} onChange={(e) => setJoinPassword(e.target.value)} />}
              <SecondaryButton type="submit" disabled={isCreating || isJoining} className="w-full">{isJoining ? 'Joining room…' : 'Join room'}</SecondaryButton>
            </form>
          </Card>
        </div>
        {error && <p className="rounded-xl border-2 border-black bg-[#fee2e2] px-3 py-2 text-sm text-red-700">{error}</p>}
      </Card>
    </main>
  );
}

function LoginForm({ onSubmit, onBack, onForgot, setError }: { onSubmit: (i: string, p: string) => Promise<void>; onBack: () => void; onForgot: () => void; setError: (v: string | null) => void }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  return (
    <form className="space-y-3" onSubmit={(e) => {
      e.preventDefault();
      setError(null);
      setSubmitting(true);
      onSubmit(identifier, password).catch((err) => setError((err as Error).message)).finally(() => setSubmitting(false));
    }}>
      <Input placeholder="Email or username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
      <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <Button className="w-full" disabled={submitting}>{submitting ? 'Logging in…' : 'Login'}</Button>
      <button type="button" onClick={onForgot} className="text-sm font-medium text-gray-700 underline">Forgot password?</button>
      <button type="button" onClick={onBack} className="block text-sm text-gray-700">Back</button>
    </form>
  );
}

function RegisterForm({ onSubmit, onBack, setError }: { onSubmit: (e: string, u: string, p: string, c: string) => Promise<void>; onBack: () => void; setError: (v: string | null) => void }) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  return (
    <form className="space-y-3" onSubmit={(e) => {
      e.preventDefault();
      setError(null);
      setSubmitting(true);
      onSubmit(email, username, password, confirm).catch((err) => setError((err as Error).message)).finally(() => setSubmitting(false));
    }}>
      <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
      <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <Input type="password" placeholder="Confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      <Button className="w-full" disabled={submitting}>{submitting ? 'Creating account…' : 'Create account'}</Button>
      <button type="button" onClick={onBack} className="block text-sm text-gray-700">Back</button>
    </form>
  );
}

function ForgotRequest({ onBack, onSent, setError }: { onBack: () => void; onSent: (email: string) => void; setError: (v: string | null) => void }) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  return (
    <form className="space-y-3" onSubmit={(e) => {
      e.preventDefault();
      setError(null);
      setSubmitting(true);
      requestResetCode(email)
        .then((res) => {
          setMessage(res.message);
          onSent(email);
        })
        .catch((err) => setError((err as Error).message))
        .finally(() => setSubmitting(false));
    }}>
      <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Button className="w-full" disabled={submitting}>{submitting ? 'Sending…' : 'Send reset code'}</Button>
      {message && <p className="text-xs text-gray-600">{message}</p>}
      <button type="button" onClick={onBack} className="block text-sm text-gray-700">Back</button>
    </form>
  );
}

function ForgotVerify({ email, onBack, setError }: { email: string; onBack: () => void; setError: (v: string | null) => void }) {
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  return (
    <form className="space-y-3" onSubmit={(e) => {
      e.preventDefault();
      setError(null);
      setSubmitting(true);
      verifyResetCode({ email, code, password, confirmPassword })
        .then((res) => setMessage(res.message))
        .catch((err) => setError((err as Error).message))
        .finally(() => setSubmitting(false));
    }}>
      <Input value={email} disabled />
      <Input placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} />
      <Input type="password" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <Input type="password" placeholder="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
      <Button className="w-full" disabled={submitting}>{submitting ? 'Resetting…' : 'Reset password'}</Button>
      {message && <p className="text-xs text-emerald-700">{message}</p>}
      <button type="button" onClick={onBack} className="block text-sm text-gray-700">Back to login</button>
    </form>
  );
}
