'use client';

import { ChangeEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { Button, Card, Input, SecondaryButton } from '@/components/ui';
import { updateProfile } from '@/lib/api';

export default function ProfilePage() {
  const { user, refresh } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [profileImageDataUri, setProfileImageDataUri] = useState<string | undefined>();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    if (user.role === 'guest') {
      router.push('/');
      return;
    }
    setUsername(user.username);
    setEmail(user.email || '');
  }, [user, router]);

  const onImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setProfileImageDataUri(reader.result as string);
    reader.readAsDataURL(file);
  };

  if (!user || user.role === 'guest') return null;

  const avatar = profileImageDataUri || user.profileImage;

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <Card className="brand-panel space-y-5 bg-[color:var(--surface)] p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-2xl font-extrabold text-[color:var(--primary)]">Your Froddle profile</h1><p className="mt-1 text-sm text-[color:var(--text-muted)]">Update your saved identity without affecting room, auth, or guest behavior.</p></div><SecondaryButton onClick={() => router.push('/')}>Back home</SecondaryButton></div>
        <div className="grid gap-5 lg:grid-cols-[auto_1fr] lg:items-start">
          <div className="flex flex-col items-start gap-3">
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border-2 border-[color:var(--border)] bg-[color:var(--surface-soft)] transition hover:scale-105">
              {avatar ? <img src={avatar} alt="Profile" className="absolute inset-0 h-full w-full rounded-full object-cover object-center" /> : <span className="grid h-full w-full place-items-center text-2xl font-semibold text-[color:var(--primary)]">{user.username.slice(0, 1)}</span>}
            </div>
            <Input type="file" accept="image/*" onChange={onImageChange} className="max-w-xs" />
          </div>
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-[color:var(--primary)]">Username<Input value={username} onChange={(e) => setUsername(e.target.value)} className="mt-1" /></label>
            <label className="block text-sm font-semibold text-[color:var(--primary)]">Email<Input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" /></label>
            <Button
              onClick={() => {
                setError('');
                setMessage('');
                updateProfile({ username, email, profileImageDataUri })
                  .then((res) => {
                    setMessage(res.message || 'Changes saved');
                    refresh();
                  })
                  .catch((e) => setError((e as Error).message));
              }}
              className="w-full sm:w-auto"
            >
              Save changes
            </Button>
          </div>
        </div>

        {message && <p className="status-banner status-success">{message}</p>}
        {error && <p className="status-banner status-danger">{error}</p>}
      </Card>
    </main>
  );
}
