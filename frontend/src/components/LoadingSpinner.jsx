import { cn } from '@/lib/utils';

function SoccerBall({ className }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      aria-hidden
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="32" cy="32" r="29" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
      <path
        d="M32 10 L38.5 22 L34 34 L30 34 L25.5 22 Z"
        fill="#0f172a"
        stroke="#0f172a"
        strokeWidth="0.5"
        strokeLinejoin="round"
      />
      <path
        d="M32 10 L38.5 22 L48 18 L44 28 L52 34 L42 38 L38.5 22"
        fill="#e2e8f0"
        stroke="#94a3b8"
        strokeWidth="0.75"
        strokeLinejoin="round"
      />
      <path
        d="M32 10 L25.5 22 L16 18 L20 28 L12 34 L22 38 L25.5 22"
        fill="#e2e8f0"
        stroke="#94a3b8"
        strokeWidth="0.75"
        strokeLinejoin="round"
      />
      <path
        d="M34 34 L44 28 L48 38 L40 46 L32 54 L24 46 L16 38 L20 28 L30 34"
        fill="#e2e8f0"
        stroke="#94a3b8"
        strokeWidth="0.75"
        strokeLinejoin="round"
      />
      <path
        d="M30 34 L20 28 L16 38 L24 46"
        fill="#f1f5f9"
        stroke="#94a3b8"
        strokeWidth="0.75"
        strokeLinejoin="round"
      />
      <path
        d="M34 34 L44 28 L48 38 L40 46"
        fill="#f1f5f9"
        stroke="#94a3b8"
        strokeWidth="0.75"
        strokeLinejoin="round"
      />
    </svg>
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
          'loading-spinner__stage relative flex items-end justify-center',
          isCompact ? 'h-12 w-12' : 'h-20 w-20'
        )}
      >
        <div className="loading-spinner__ring absolute inset-0 rounded-full border-2 border-dashed border-amber-500/35" />
        <div className="loading-spinner__glow absolute inset-2 rounded-full bg-amber-500/10 blur-md" />
        <div className={cn('loading-spinner__ball relative z-10', isCompact ? 'size-7' : 'size-10')}>
          <SoccerBall className="size-full drop-shadow-md" />
        </div>
        <div
          className={cn(
            'loading-spinner__shadow absolute bottom-0 rounded-full bg-black/35 blur-[2px]',
            isCompact ? 'h-1 w-5' : 'h-1.5 w-8'
          )}
        />
      </div>

      {label ? (
        <p
          className={cn(
            'loading-spinner__label font-medium text-muted-foreground',
            isCompact ? 'text-xs' : 'text-sm'
          )}
        >
          {label}
        </p>
      ) : null}
    </div>
  );
}
