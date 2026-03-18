import { cn } from '@/lib/utils';

export function FroddleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 96" aria-hidden="true" className={cn('h-12 w-12', className)}>
      <rect x="8" y="10" width="80" height="72" rx="28" fill="#1fb76a" stroke="#1a1a1a" strokeWidth="4" />
      <circle cx="32" cy="28" r="12" fill="#fff7e8" stroke="#1a1a1a" strokeWidth="4" />
      <circle cx="64" cy="28" r="12" fill="#fff7e8" stroke="#1a1a1a" strokeWidth="4" />
      <circle cx="34" cy="30" r="4" fill="#1a1a1a" />
      <circle cx="62" cy="30" r="4" fill="#1a1a1a" />
      <path d="M30 52c5 7 12 10 18 10s13-3 18-10" fill="none" stroke="#1a1a1a" strokeLinecap="round" strokeWidth="4" />
      <circle cx="20" cy="54" r="5" fill="#ffd84d" opacity="0.95" />
      <circle cx="76" cy="56" r="5" fill="#ff5d5d" opacity="0.95" />
      <path d="M42 65h12" stroke="#1c7dd7" strokeLinecap="round" strokeWidth="4" />
    </svg>
  );
}

export function FroddleWordmark({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <FroddleMark className="h-14 w-14 shrink-0 sm:h-16 sm:w-16" />
      <div className="min-w-0">
        <div className="text-xs font-black uppercase tracking-[0.28em] text-[color:var(--text-muted)]">Froddle</div>
        <div className="text-2xl font-black leading-none text-[color:var(--text-main)] sm:text-3xl">Creative frog-powered collab</div>
      </div>
    </div>
  );
}
