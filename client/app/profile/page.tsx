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
    <main className="mx-auto max-w-xl p-6">
      <Card className="space-y-4">
        <div className="flex items-center justify-between"><h1 className="text-2xl font-extrabold text-purple-900">Your Creative Profile</h1><SecondaryButton onClick={() => router.push('/')}>Back Home</SecondaryButton></div>
        <div className="flex items-center gap-3">
          <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-full border-2 border-pink-200 bg-pink-50 transition hover:scale-105">
            {avatar ? <img src={avatar} alt="Profile" className="h-full w-full object-cover" /> : <span className="text-lg font-semibold text-purple-700">{user.username.slice(0, 1)}</span>}
          </div>
          <Input type="file" accept="image/*" onChange={onImageChange} />
        </div>

        <label className="block text-sm font-semibold text-purple-800">Username<Input value={username} onChange={(e) => setUsername(e.target.value)} className="mt-1" /></label>
        <label className="block text-sm font-semibold text-purple-800">Email<Input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" /></label>

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
          className="w-full"
        >
          Save changes
        </Button>

        {message && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
        {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      </Card>
    </main>
  );
}
