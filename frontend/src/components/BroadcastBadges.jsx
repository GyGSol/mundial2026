import { cn } from '@/lib/utils';

export default function BroadcastBadges({ broadcasters = [], className, size = 'sm' }) {
  if (!broadcasters?.length) return null;

  const heightClass = size === 'md' ? 'h-5' : 'h-4';

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {broadcasters.map((broadcaster) => (
        <img
          key={broadcaster.id}
          src={broadcaster.logo}
          alt={broadcaster.name}
          title={broadcaster.name}
          className={cn(heightClass, 'w-auto rounded-sm object-contain')}
        />
      ))}
    </div>
  );
}
