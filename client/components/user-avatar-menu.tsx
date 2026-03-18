'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { Button, SecondaryButton } from '@/components/ui';

export function UserAvatarMenu() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  if (!user) return null;

  const initials = user.username.slice(0, 2).toUpperCase();

  return (
    <div ref={containerRef} className="relative">
      <button onClick={() => setOpen((prev) => !prev)} className="grid h-11 w-11 place-items-center overflow-hidden rounded-full border-2 border-black bg-[#f4efe2] shadow-sm transition hover:-translate-y-0.5">
        {user.profileImage ? <img src={user.profileImage} alt={user.username} className="h-full w-full object-cover" /> : <span className="text-xs font-bold text-slate-900">{initials}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-64 space-y-3 rounded-[1.5rem] border-2 border-black bg-[#fffdf7] p-4 shadow-[8px_8px_0_rgba(17,24,39,0.08)]">
          <div>
            <p className="text-sm font-bold text-slate-900">{user.username}</p>
            <p className="text-xs text-slate-600">{user.role === 'guest' ? 'Guest session' : pathname === '/profile' ? 'Account settings' : 'Signed in'}</p>
          </div>
          {user.role === 'guest' ? (
            <>
              <p className="text-xs text-slate-600">Guest mode is active. Save your identity to keep the same profile across rooms.</p>
              <SecondaryButton className="w-full" onClick={() => { setOpen(false); router.push('/auth?view=login'); }}>Login / Create Account</SecondaryButton>
            </>
          ) : (
            <>
              <SecondaryButton className="w-full" onClick={() => { setOpen(false); router.push('/profile'); }}>Profile</SecondaryButton>
              <Button className="w-full" onClick={async () => { setOpen(false); await logout(); if (pathname !== '/') router.push('/'); }}>Logout</Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
