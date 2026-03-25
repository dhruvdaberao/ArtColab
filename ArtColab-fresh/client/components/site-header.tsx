'use client';

import { UserAvatarMenu } from '@/components/user-avatar-menu';
import { FroddleLogoLink } from '@/components/froddle-logo';

export function SiteHeader({ compact = false }: { compact?: boolean }) {
  return (
    <header className={`mb-4 flex items-start justify-between gap-3 sm:mb-5 ${compact ? '' : 'lg:mb-6'}`}>
      <FroddleLogoLink priority imageClassName={compact ? 'max-w-[112px] sm:max-w-[132px]' : 'max-w-[120px] sm:max-w-[148px]'} />
      <div className="shrink-0">
        <UserAvatarMenu />
      </div>
    </header>
  );
}
