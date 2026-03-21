'use client';

import { ChangeEvent, useEffect, useId, useState } from 'react';
import { Camera } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { SiteHeader } from '@/components/site-header';
import { useAuth } from '@/components/auth-provider';
import { Button, Input, Card, SecondaryButton } from '@/components/ui';
import { updateProfile } from '@/lib/api';

export default function ProfilePage() {
  const { user, refresh } = useAuth();
  const router = useRouter();
  const fileInputId = useId();
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
      <SiteHeader compact />
      <Card className="space-y-5 bg-[color:var(--surface)] p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-black text-[color:var(--text-main)]">Your Froddle profile</h1>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">
              Update your saved identity without affecting rooms, auth, or guest behavior.
            </p>
          </div>
          <SecondaryButton onClick={() => router.push('/')}>Back home</SecondaryButton>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,220px)_1fr] lg:items-start">
          <div className="flex flex-col items-center gap-3 lg:pt-2">
            <label htmlFor={fileInputId} className="group relative block cursor-pointer">
              <span className="sr-only">Change profile photo</span>
              <div className="relative h-28 w-28 overflow-hidden rounded-full border-2 border-[color:var(--border)] bg-[color:var(--surface-soft)] shadow-[0_10px_30px_rgba(26,26,26,0.12)] transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[0_14px_34px_rgba(26,26,26,0.16)] group-focus-within:ring-2 group-focus-within:ring-[color:var(--brand-blue)] group-focus-within:ring-offset-2 group-focus-within:ring-offset-[color:var(--surface)] sm:h-32 sm:w-32">
                {avatar ? (
                  <img
                    src={avatar}
                    alt="Profile"
                    className="absolute inset-0 h-full w-full rounded-full object-cover object-center"
                  />
                ) : (
                  <span className="grid h-full w-full place-items-center text-3xl font-semibold text-[color:var(--primary)]">
                    {user.username.slice(0, 1)}
                  </span>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-80 transition duration-200 group-hover:opacity-100" />
                <span className="absolute bottom-2 right-2 inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-white/80 bg-[color:var(--surface)] text-[color:var(--text-main)] shadow-[0_8px_18px_rgba(26,26,26,0.18)] transition duration-200 group-hover:scale-105">
                  <Camera className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
            </label>
            <Input
              id={fileInputId}
              type="file"
              accept="image/*"
              onChange={onImageChange}
              className="sr-only"
            />
            <p className="text-center text-xs font-semibold tracking-[0.08em] text-[color:var(--text-muted)] uppercase">
              Tap or click the avatar to change photo
            </p>
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-semibold text-[color:var(--text-main)]">
              Username
              <Input value={username} onChange={(e) => setUsername(e.target.value)} className="mt-1" />
            </label>
            <label className="block text-sm font-semibold text-[color:var(--text-main)]">
              Email
              <Input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" />
            </label>
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
