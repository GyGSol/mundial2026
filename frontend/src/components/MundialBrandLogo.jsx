import { cn } from '@/lib/utils';

export default function MundialBrandLogo({ className, size = 'header' }) {
  const trophyClass =
    size === 'header'
      ? 'h-9 w-auto sm:h-10'
      : 'h-8 w-auto';

  return (
    <span className={cn('mundial-brand-logo inline-flex items-center gap-2.5', className)}>
      <img
        src="/world-cup-trophy.png"
        alt=""
        aria-hidden
        className={cn(
          'shrink-0 object-contain drop-shadow-[0_4px_12px_rgba(245,158,11,0.35)]',
          trophyClass
        )}
        draggable={false}
      />
      <span className="flex min-w-0 flex-col leading-none">
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary sm:text-[11px]">
          Mundial
        </span>
        <span className="text-lg font-bold tracking-tight text-foreground sm:text-xl">2026</span>
      </span>
    </span>
  );
}
