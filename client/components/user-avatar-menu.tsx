'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { Button, SecondaryButton } from '@/components/ui';

export function UserAvatarMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  const initials = user.username.slice(0, 2).toUpperCase();

  return (
    <div className="relative">
      <button onClick={() => setOpen((prev) => !prev)} className="h-11 w-11 overflow-hidden rounded-full border-2 border-pink-200 bg-pink-50 shadow-sm transition hover:scale-105">
        {user.profileImage ? <img src={user.profileImage} alt={user.username} className="h-full w-full object-cover" /> : <span className="text-xs font-bold text-purple-800">{initials}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-56 space-y-2 rounded-2xl border border-fuchsia-100 bg-white p-3 shadow-lg animate-[pop-in_0.2s_ease-out]">
          <p className="text-sm font-semibold text-purple-800">{user.username}</p>
          {user.role === 'guest' ? (
            <>
              <p className="text-xs text-purple-500">You are doodling in guest mode.</p>
              <Link href="/" className="block">
                <SecondaryButton className="w-full">Login / Create Account</SecondaryButton>
              </Link>
            </>
          ) : (
            <>
              <Link href="/profile" className="block">
                <SecondaryButton className="w-full">Profile</SecondaryButton>
              </Link>
              <Button onClick={() => logout()} className="w-full bg-rose-500 hover:bg-rose-400">
                Logout
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
