'use client';

import { UserAvatarMenu } from '@/components/user-avatar-menu';
import { FroddleLogoLink } from '@/components/froddle-logo';

export function SiteHeader({ compact = false }: { compact?: boolean }) {
  return (
    <header className="mb-6 flex items-center justify-between gap-3 rounded-[24px] border-2 border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 shadow-[var(--shadow)] sm:px-5 sm:py-4">
      <FroddleLogoLink priority imageClassName={compact ? 'max-w-[120px] sm:max-w-[150px]' : 'max-w-[140px] sm:max-w-[180px]'} />
      <div className="shrink-0">
        <UserAvatarMenu />
      </div>
    </header>
  );
}
