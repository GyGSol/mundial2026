import { useId } from 'react';
import { cn } from '@/lib/utils';

/**
 * Badge estilizado de ranking mundial (globo + barras), sin marca FIFA registrada.
 */
export function FifaRankingIcon({ className, ...props }) {
  const gradientId = useId();

  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('size-3.5 shrink-0 md:size-4', className)}
      aria-hidden="true"
      {...props}
    >
      <defs>
        <linearGradient id={gradientId} x1="2" y1="2" x2="18" y2="18" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38bdf8" />
          <stop offset="0.55" stopColor="#2563eb" />
          <stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="18" height="18" rx="5" fill={`url(#${gradientId})`} />
      <rect
        x="1"
        y="1"
        width="18"
        height="18"
        rx="5"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="0.6"
      />
      <circle cx="10" cy="8.5" r="4.2" stroke="rgba(255,255,255,0.92)" strokeWidth="0.85" />
      <path
        d="M5.8 8.5h8.4"
        stroke="rgba(255,255,255,0.75)"
        strokeWidth="0.65"
        strokeLinecap="round"
      />
      <path
        d="M10 4.3c1.55 1.45 1.55 4.25 0 5.7"
        stroke="rgba(255,255,255,0.75)"
        strokeWidth="0.65"
        strokeLinecap="round"
      />
      <path
        d="M10 4.3c-1.55 1.45-1.55 4.25 0 5.7"
        stroke="rgba(255,255,255,0.75)"
        strokeWidth="0.65"
        strokeLinecap="round"
      />
      <rect x="5.5" y="13.8" width="2.2" height="3.2" rx="0.45" fill="rgba(255,255,255,0.55)" />
      <rect x="8.9" y="12.4" width="2.2" height="4.6" rx="0.45" fill="rgba(255,255,255,0.78)" />
      <rect x="12.3" y="14.6" width="2.2" height="2.4" rx="0.45" fill="rgba(255,255,255,0.55)" />
    </svg>
  );
}
