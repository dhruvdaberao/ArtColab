'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown, CircleUserRound, LogOut, Sparkles } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { Button, SecondaryButton, SuccessButton } from '@/components/ui';
import { getAvatarInitials, resolveSessionDisplayName } from '@/lib/guest';

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

  const displayName = resolveSessionDisplayName(user);
  const initials = getAvatarInitials(displayName);

  return (
    <div ref={containerRef} className="relative z-[80]">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className="inline-flex h-12 items-center gap-2 rounded-full border-2 border-[color:var(--border)] bg-[linear-gradient(180deg,#fffef8_0%,#eef7d8_100%)] px-1.5 pr-3 shadow-[0_6px_0_rgba(26,26,26,0.12)] transition hover:-translate-y-0.5 hover:bg-[color:var(--surface-soft)]"
      >
        <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-full border border-[color:var(--border)] bg-[color:var(--surface-soft)] text-[11px] font-bold text-[color:var(--primary)]">
          {user.profileImage ? <img src={user.profileImage} alt={displayName} className="h-full w-full object-cover" /> : initials}
        </span>
        <span className="hidden max-w-[9rem] truncate text-sm font-black text-[color:var(--text-main)] sm:block">{displayName}</span>
        <ChevronDown className={`h-4 w-4 text-[color:var(--primary)] transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-3 w-[min(18rem,calc(100vw-2rem))] space-y-4 rounded-[1.75rem] border-2 border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow)]">
          <div className="flex items-center gap-3 rounded-[1.25rem] border border-[color:var(--primary)]/15 bg-[color:var(--bg-elevated)] px-3 py-3">
            <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-full border border-[color:var(--border)] bg-[color:var(--surface-soft)] text-sm font-bold text-[color:var(--primary)]">
              {user.profileImage ? <img src={user.profileImage} alt={displayName} className="h-full w-full object-cover" /> : initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-[color:var(--text-main)]">{displayName}</p>
              <p className="text-xs text-[color:var(--text-muted)]">{user.role === 'guest' ? 'Guest session' : pathname === '/profile' ? 'Account settings' : 'Signed in'}</p>
            </div>
          </div>
          {user.role === 'guest' ? (
            <>
              <div className="rounded-[1.25rem] border border-[color:var(--primary)]/15 bg-[color:var(--surface-soft)] px-3 py-3 text-xs leading-5 text-[color:var(--text-muted)]">
                <div className="mb-1 inline-flex items-center gap-2 font-semibold text-[color:var(--primary)]"><Sparkles className="h-4 w-4" /> Keep this identity</div>
                Guest mode is active. Create an account to keep your profile and room history across sessions.
              </div>
              <SuccessButton className="w-full justify-center" onClick={() => { setOpen(false); const redirect = encodeURIComponent(pathname || '/'); router.push(`/auth?view=register&redirect=${redirect}`); }}>
                ✨ Create account
              </SuccessButton>
              <SecondaryButton className="w-full justify-center" onClick={() => { setOpen(false); const redirect = encodeURIComponent(pathname || '/'); router.push(`/auth?view=login&redirect=${redirect}`); }}>
                <CircleUserRound className="h-4 w-4" /> Login
              </SecondaryButton>
            </>
          ) : (
            <div className="space-y-2">
              <SecondaryButton className="w-full justify-center" onClick={() => { setOpen(false); router.push('/profile'); }}>
                <CircleUserRound className="h-4 w-4" /> 👤 Profile
              </SecondaryButton>
              <Button className="w-full justify-center" onClick={async () => { setOpen(false); await logout(); if (pathname !== '/') router.push('/'); }}>
                <LogOut className="h-4 w-4" /> Logout
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
