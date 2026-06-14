import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

/** Logo height (px) and max width ≈ height × φ² (φ ≈ 1.618) for balanced proportions */
const SIZE_STYLES = {
  xs: {
    height: 'h-4',
    maxWidth: 'max-w-10',
    gap: 'gap-1.5',
    wrap: 'flex-wrap',
  },
  sm: {
    height: 'h-5',
    maxWidth: 'max-w-11',
    gap: 'gap-1.5',
    wrap: 'flex-wrap',
  },
  md: {
    height: 'h-5',
    maxWidth: 'max-w-12',
    gap: 'gap-2',
    wrap: 'flex-wrap',
  },
};

export default function BroadcastBadges({
  broadcasters = [],
  className,
  size = 'sm',
  label,
}) {
  if (!broadcasters?.length) return null;

  const styles = SIZE_STYLES[size] ?? SIZE_STYLES.sm;

  const logos = (
    <div
      className={cn(
        'flex items-center justify-center',
        styles.wrap,
        styles.gap,
        label ? 'w-full' : className
      )}
    >
      {broadcasters.map((broadcaster) => (
        <Link
          key={broadcaster.id}
          to="/transmissions"
          title={`Transmisiones · ${broadcaster.name}`}
          className="inline-flex shrink-0 rounded-sm outline-none ring-offset-background transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <img
            src={broadcaster.logo}
            alt={broadcaster.name}
            loading="lazy"
            decoding="async"
            className={cn(
              styles.height,
              styles.maxWidth,
              'w-auto shrink-0 object-contain object-center'
            )}
          />
        </Link>
      ))}
    </div>
  );

  if (!label) return logos;

  return (
    <div className={cn('flex w-full flex-col items-center gap-1', className)}>
      <p className="text-center text-xs font-medium text-muted-foreground">{label}</p>
      {logos}
    </div>
  );
}
