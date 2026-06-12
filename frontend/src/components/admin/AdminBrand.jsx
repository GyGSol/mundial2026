import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AdminBrand({
  title = 'Panel de administración',
  subtitle = 'Mundial 2026',
  description,
  compact = false,
  className,
}) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div
        className={cn(
          'flex shrink-0 items-center justify-center rounded-xl bg-amber-500/18 text-amber-400 shadow-[0_0_24px_rgba(245,158,11,0.22)] ring-1 ring-amber-500/40',
          compact ? 'size-9' : 'size-10'
        )}
        aria-hidden
      >
        <ShieldCheck className={compact ? 'size-4' : 'size-5'} strokeWidth={2.25} />
      </div>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-amber-400/90">{subtitle}</p>
        <p
          className={cn(
            'font-semibold text-slate-100',
            compact ? 'text-base' : 'text-lg'
          )}
        >
          {title}
        </p>
        {description ? (
          <p className="text-sm text-slate-400">{description}</p>
        ) : null}
      </div>
    </div>
  );
}
