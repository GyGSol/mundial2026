import { cn } from '@/lib/utils';

const SIZE_CLASSES = {
  xs: 'size-6',
  sm: 'size-8',
  md: 'size-10',
  lg: 'size-16',
  xl: 'size-24',
};

const PORTRAIT_SIZE_CLASSES = {
  xs: 'max-h-10 max-w-[2.25rem]',
  sm: 'max-h-20 max-w-[4.5rem]',
  md: 'max-h-28 max-w-[5.5rem]',
  lg: 'max-h-36 max-w-[7rem]',
  xl: 'max-h-48 max-w-[9rem]',
  hero: 'max-h-52 max-w-[11rem] sm:max-h-60 sm:max-w-[13rem]',
};

export default function PlayerAvatar({
  name,
  photoUrl,
  className,
  size = 'md',
  variant = 'circle',
}) {
  const sizeClass = SIZE_CLASSES[size] ?? SIZE_CLASSES.md;
  const portraitClass = PORTRAIT_SIZE_CLASSES[size] ?? PORTRAIT_SIZE_CLASSES.md;

  if (!photoUrl) {
    if (variant === 'portrait') {
      return (
        <span
          className={cn(
            'inline-flex aspect-[3/4] w-full items-center justify-center rounded-2xl border border-neutral-200 bg-white text-sm font-semibold uppercase text-neutral-400',
            portraitClass,
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
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-full border border-border bg-white text-xs font-semibold uppercase text-muted-foreground',
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

  if (variant === 'portrait') {
    return (
      <img
        src={photoUrl}
        alt=""
        className={cn(
          'w-full object-contain object-bottom',
          portraitClass,
          className
        )}
        loading="lazy"
      />
    );
  }

  return (
    <img
      src={photoUrl}
      alt=""
      className={cn(
        'shrink-0 rounded-full border border-border bg-white object-cover object-top',
        sizeClass,
        className
      )}
      loading="lazy"
    />
  );
}
