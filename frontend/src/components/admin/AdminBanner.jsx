import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AdminBanner({ src, variant, className, imageClassName }) {
  if (variant === 'auth') {
    return (
      <div
        className={cn(
          'relative flex h-28 items-center justify-center overflow-hidden sm:h-32',
          'bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950/40',
          className
        )}
        aria-hidden
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-500/15 via-transparent to-transparent" />
        <div className="relative flex size-14 items-center justify-center rounded-xl bg-amber-500/20 ring-1 ring-amber-500/35">
          <ShieldCheck className="size-7 text-amber-400" strokeWidth={2.25} />
        </div>
      </div>
    );
  }

  if (!src) return null;

  return (
    <div className={cn('relative overflow-hidden', className)}>
      <img
        src={src}
        alt=""
        className={cn(
          'h-28 w-full object-cover object-center sm:h-36',
          imageClassName
        )}
        loading="lazy"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/50 to-transparent"
        aria-hidden
      />
    </div>
  );
}
