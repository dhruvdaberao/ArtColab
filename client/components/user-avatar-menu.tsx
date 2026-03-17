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
      <button onClick={() => setOpen((prev) => !prev)} className="h-10 w-10 overflow-hidden rounded-full border border-slate-300 bg-slate-100">
        {user.profileImage ? <img src={user.profileImage} alt={user.username} className="h-full w-full object-cover" /> : <span className="text-xs font-semibold">{initials}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-56 space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <p className="text-sm font-medium text-slate-800">{user.username}</p>
          {user.role === 'guest' ? (
            <>
              <p className="text-xs text-slate-500">You are using guest access.</p>
              <Link href="/" className="block">
                <SecondaryButton className="w-full">Login / Create Account</SecondaryButton>
              </Link>
            </>
          ) : (
            <>
              <Link href="/profile" className="block">
                <SecondaryButton className="w-full">Profile</SecondaryButton>
              </Link>
              <Button onClick={() => logout()} className="w-full bg-rose-600 hover:bg-rose-500">
                Logout
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
