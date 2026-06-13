import { useId } from 'react';
import { cn } from '@/lib/utils';

function ModernSoccerBall({ className, gradientId }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      aria-hidden
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id={gradientId} cx="38%" cy="32%" r="68%" fx="32%" fy="26%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="45%" stopColor="#f4f4f5" />
          <stop offset="100%" stopColor="#a1a1aa" />
        </radialGradient>
        <linearGradient id={`${gradientId}-panel`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#18181b" />
          <stop offset="100%" stopColor="#09090b" />
        </linearGradient>
      </defs>

      <circle cx="50" cy="50" r="46" fill={`url(#${gradientId})`} />
      <circle cx="50" cy="50" r="46" stroke="rgba(255,255,255,0.35)" strokeWidth="0.75" />

      {/* Patrón icosaédrico simplificado — legible también en tamaño chico */}
      <path
        d="M50 14 L58.2 28.5 L54.5 44 L45.5 44 L41.8 28.5 Z"
        fill={`url(#${gradientId}-panel)`}
      />
      <path
        d="M50 14 L58.2 28.5 L68 24 L64 36 L74 44 L62 48 L58.2 28.5"
        fill="#e4e4e7"
        stroke="#d4d4d8"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
      <path
        d="M50 14 L41.8 28.5 L32 24 L36 36 L26 44 L38 48 L41.8 28.5"
        fill="#e4e4e7"
        stroke="#d4d4d8"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
      <path
        d="M45.5 44 L36 36 L32 52 L40 62 L50 68 L60 62 L68 52 L64 36 L54.5 44 Z"
        fill="#f4f4f5"
        stroke="#d4d4d8"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
      <path
        d="M45.5 44 L36 36 L32 52 L40 62 L50 68"
        fill="#fafafa"
        stroke="#d4d4d8"
        strokeWidth="0.5"
        strokeLinejoin="round"
      />
      <path
        d="M54.5 44 L64 36 L68 52 L60 62 L50 68"
        fill="#fafafa"
        stroke="#d4d4d8"
        strokeWidth="0.5"
        strokeLinejoin="round"
      />
      <path
        d="M50 68 L40 62 L34 74 L42 84 L50 86 L58 84 L66 74 L60 62"
        fill="#e4e4e7"
        stroke="#d4d4d8"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />

      {/* Brillo especular */}
      <ellipse cx="36" cy="34" rx="14" ry="9" fill="white" opacity="0.42" transform="rotate(-28 36 34)" />
      <ellipse cx="62" cy="58" rx="6" ry="4" fill="white" opacity="0.12" transform="rotate(-12 62 58)" />
    </svg>
  );
}

export default function LoadingSpinner({
  label = 'Cargando…',
  variant = 'default',
  className,
}) {
  const gradientId = useId().replace(/:/g, '');
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
          isCompact ? 'size-14' : 'size-[5.5rem]'
        )}
      >
        <div className="loading-spinner__orbit" aria-hidden />
        <div className="loading-spinner__glow" aria-hidden />

        <div className="loading-spinner__ball-wrap relative z-10 flex items-center justify-center">
          <div
            className={cn(
              'loading-spinner__ball',
              isCompact ? 'size-8' : 'size-11'
            )}
          >
            <ModernSoccerBall
              gradientId={gradientId}
              className="size-full drop-shadow-[0_8px_16px_rgba(0,0,0,0.35)]"
            />
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
