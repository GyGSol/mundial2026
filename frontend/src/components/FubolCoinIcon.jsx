import { useId } from 'react';
import { cn } from '@/lib/utils';

const sizeClass = {
  sm: 'h-5 w-5',
  md: 'h-7 w-7',
  lg: 'h-12 w-12',
};

/** Moneda Fubol acuñada: «1» + «Fubol», sin halo; escala al hover. */
export default function FubolCoinIcon({ size = 'md', className, alt = 'Fubol' }) {
  const uid = useId().replace(/:/g, '');
  const faceId = `fubol-face-${uid}`;
  const rimId = `fubol-rim-${uid}`;
  const patchId = `fubol-patch-${uid}`;

  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label={alt}
      className={cn(
        'inline-block shrink-0 transition-transform duration-200 ease-out hover:scale-[1.28] motion-reduce:transition-none motion-reduce:hover:scale-100',
        sizeClass[size] || sizeClass.md,
        className
      )}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id={faceId} cx="38%" cy="32%" r="68%">
          <stop offset="0%" stopColor="#f0d878" />
          <stop offset="45%" stopColor="#c9a227" />
          <stop offset="100%" stopColor="#7a5a12" />
        </radialGradient>
        <linearGradient id={rimId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a67c1a" />
          <stop offset="50%" stopColor="#6b4f0a" />
          <stop offset="100%" stopColor="#3d2d06" />
        </linearGradient>
        <pattern id={patchId} width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="4" height="4" fill="#2d5a34" fillOpacity="0.12" />
          <rect x="4" y="4" width="4" height="4" fill="#e8dcc8" fillOpacity="0.1" />
        </pattern>
      </defs>

      {/* Borde acuñado */}
      <circle cx="32" cy="32" r="30" fill={`url(#${rimId})`} />
      <circle cx="32" cy="32" r="26.5" fill={`url(#${faceId})`} />
      <circle cx="32" cy="32" r="26.5" fill={`url(#${patchId})`} />

      {/* Surco interior */}
      <circle
        cx="32"
        cy="32"
        r="24"
        fill="none"
        stroke="#5c4510"
        strokeOpacity="0.35"
        strokeWidth="0.75"
      />

      {/* Número acuñado */}
      <text
        x="32"
        y="36"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="26"
        fontWeight="700"
        fontFamily="system-ui, -apple-system, 'Segoe UI', sans-serif"
        fill="#3d2d06"
        stroke="#f5e6a8"
        strokeWidth="0.6"
        paintOrder="stroke"
      >
        1
      </text>

      {/* Leyenda */}
      <text
        x="32"
        y="47"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="8.5"
        fontWeight="600"
        fontFamily="system-ui, -apple-system, 'Segoe UI', sans-serif"
        letterSpacing="0.35"
        fill="#3d2d06"
        stroke="#e8c96a"
        strokeWidth="0.25"
        paintOrder="stroke"
      >
        Fubol
      </text>
    </svg>
  );
}
