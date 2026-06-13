import { cn } from '@/lib/utils';

const TRIONDA_BALL_SRC = '/balls/trionda-official.webp';

function TriondaBall({ className }) {
  return (
    <img
      src={TRIONDA_BALL_SRC}
      alt=""
      aria-hidden
      draggable={false}
      className={cn(
        'size-full rounded-full object-cover object-center',
        'drop-shadow-[0_10px_18px_rgba(0,0,0,0.45)]',
        className
      )}
    />
  );
}

export default function LoadingSpinner({
  label = 'Cargando…',
  variant = 'default',
  className,
}) {
  const isFullscreen = variant === 'fullscreen';
  const isCompact = variant === 'compact';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        'loading-spinner flex flex-col items-center justify-center gap-4 text-center',
        isFullscreen && 'min-h-screen px-4',
        !isFullscreen && !isCompact && 'py-14',
        isCompact && 'gap-2 py-6',
        className
      )}
    >
      <div
        className={cn(
          'loading-spinner__stage relative flex items-center justify-center',
          isCompact ? 'size-16' : 'size-[6.25rem]'
        )}
      >
        <div className="loading-spinner__orbit" aria-hidden />
        <div className="loading-spinner__glow" aria-hidden />

        <div className="loading-spinner__ball-wrap relative z-10 flex items-center justify-center">
          <div
            className={cn(
              'loading-spinner__ball overflow-hidden rounded-full bg-transparent',
              isCompact ? 'size-10' : 'size-14'
            )}
          >
            <TriondaBall />
          </div>
        </div>

        <div className="loading-spinner__shadow" aria-hidden />
      </div>

      {label ? (
        <p
          className={cn(
            'loading-spinner__label font-medium tracking-wide text-muted-foreground',
            isCompact ? 'text-xs' : 'text-sm'
          )}
        >
          {label}
        </p>
      ) : null}
    </div>
  );
}
