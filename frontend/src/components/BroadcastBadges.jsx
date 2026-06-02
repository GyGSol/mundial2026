import { cn } from '@/lib/utils';

const SIZE_STYLES = {
  xs: {
    height: 'h-3',
    maxWidth: 'max-w-9',
    gap: 'gap-1',
    wrap: 'flex-nowrap',
  },
  sm: {
    height: 'h-3.5',
    maxWidth: 'max-w-10',
    gap: 'gap-1.5',
    wrap: 'flex-wrap',
  },
  md: {
    height: 'h-4',
    maxWidth: 'max-w-11',
    gap: 'gap-1.5',
    wrap: 'flex-wrap',
  },
};

export default function BroadcastBadges({ broadcasters = [], className, size = 'sm' }) {
  if (!broadcasters?.length) return null;

  const styles = SIZE_STYLES[size] ?? SIZE_STYLES.sm;

  return (
    <div
      className={cn(
        'flex items-center justify-center',
        styles.wrap,
        styles.gap,
        className
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
}
