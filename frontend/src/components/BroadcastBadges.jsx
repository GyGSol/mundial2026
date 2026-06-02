import { cn } from '@/lib/utils';

/** Logo height (px) and max width ≈ height × φ² (φ ≈ 1.618) for balanced proportions */
const SIZE_STYLES = {
  xs: {
    height: 'h-4',
    maxWidth: 'max-w-10',
    gap: 'gap-1.5',
    wrap: 'flex-nowrap',
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
        <img
          key={broadcaster.id}
          src={broadcaster.logo}
          alt={broadcaster.name}
          title={broadcaster.name}
          loading="lazy"
          decoding="async"
          className={cn(
            styles.height,
            styles.maxWidth,
            'w-auto shrink-0 object-contain object-center'
          )}
        />
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
