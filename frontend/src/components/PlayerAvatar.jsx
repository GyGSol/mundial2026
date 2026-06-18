import { cn } from '@/lib/utils';

export default function PlayerAvatar({ name, photoUrl, className, size = 'md' }) {
  const sizeClass =
    size === 'lg' ? 'size-16' : size === 'sm' ? 'size-8' : size === 'xs' ? 'size-6' : 'size-10';

  if (!photoUrl) {
    return (
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-full border border-border bg-muted text-xs font-semibold uppercase text-muted-foreground',
          sizeClass,
          className
        )}
        aria-hidden
      >
        {String(name || '?')
          .split(/\s+/)
          .slice(0, 2)
          .map((part) => part[0])
          .join('')}
      </span>
    );
  }

  return (
    <img
      src={photoUrl}
      alt=""
      className={cn('shrink-0 rounded-full border border-border object-cover object-top', sizeClass, className)}
      loading="lazy"
    />
  );
}
