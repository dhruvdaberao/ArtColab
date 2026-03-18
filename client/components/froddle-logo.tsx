import frogLogo from '../../frog-logo.png';
import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export function FroddleLogo({
  className,
  imageClassName,
  priority = false,
}: {
  className?: string;
  imageClassName?: string;
  priority?: boolean;
}) {
  return (
    <div className={cn('flex items-center', className)}>
      <Image
        src={frogLogo}
        alt="Froddle"
        priority={priority}
        className={cn('h-auto w-full max-w-[140px] sm:max-w-[180px]', imageClassName)}
      />
    </div>
  );
}

export function FroddleLogoLink({ href = '/', className, imageClassName, priority = false }: { href?: string; className?: string; imageClassName?: string; priority?: boolean }) {
  return (
    <Link href={href} aria-label="Froddle home" className={cn('inline-flex min-w-0 shrink', className)}>
      <FroddleLogo priority={priority} imageClassName={imageClassName} />
    </Link>
  );
}
