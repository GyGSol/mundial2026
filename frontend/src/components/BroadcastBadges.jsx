import { cn } from '@/lib/utils';

export default function BroadcastBadges({ broadcasters = [], className, size = 'sm' }) {
  if (!broadcasters?.length) return null;

  const heightClass = size === 'md' ? 'h-5' : 'h-4';
  const maxWidthClass = size === 'md' ? 'max-w-[5.5rem]' : 'max-w-[4.5rem]';

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {broadcasters.map((broadcaster) => (
        <img
          key={broadcaster.id}
          src={broadcaster.logo}
          alt={broadcaster.name}
          title={broadcaster.name}
          loading="lazy"
          decoding="async"
          className={cn(heightClass, maxWidthClass, 'w-auto shrink-0 object-contain')}
        />
      ))}
    </div>
  );
}
