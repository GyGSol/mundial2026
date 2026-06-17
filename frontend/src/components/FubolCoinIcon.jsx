import { useId } from 'react';
import { cn } from '@/lib/utils';

const sizeClass = {
  sm: 'h-5 w-5',
  md: 'h-7 w-7',
  lg: 'h-12 w-12',
};

/**
 * Estilo logo Bitcoin: círculo plano + pelota de trapo de fondo + «F» blanca.
 */
export default function FubolCoinIcon({ size = 'md', className, alt = 'Fubol' }) {
  const uid = useId().replace(/:/g, '');
  const clipId = `fubol-clip-${uid}`;
  const creamId = `fubol-cream-${uid}`;
  const greenId = `fubol-green-${uid}`;

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
        <clipPath id={clipId}>
          <circle cx="32" cy="32" r="32" />
        </clipPath>
        <linearGradient id={creamId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f5ead8" />
          <stop offset="100%" stopColor="#c9b896" />
        </linearGradient>
        <linearGradient id={greenId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4a7a52" />
          <stop offset="100%" stopColor="#1e3d24" />
        </linearGradient>
      </defs>

      <g clipPath={`url(#${clipId})`}>
        {/* Base tipo Bitcoin */}
        <circle cx="32" cy="32" r="32" fill="#F7931A" />

        {/* Pelota de trapo de fondo (escala mayor, como textura) */}
        <g transform="translate(32,34) scale(1.35)" opacity="0.92">
          <path d="M0,-6 L5.7,-1.85 L12.37,-4.01 L0,-13 Z" fill={`url(#${creamId})`} />
          <path d="M5.7,-1.85 L3.53,4.85 L7.64,10.52 L12.37,-4.01 Z" fill={`url(#${creamId})`} />
          <path d="M3.53,4.85 L-3.53,4.85 L-7.64,10.52 L7.64,10.52 Z" fill={`url(#${creamId})`} />
          <path d="M-3.53,4.85 L-5.7,-1.85 L-12.37,-4.01 L-7.64,10.52 Z" fill={`url(#${creamId})`} />
          <path d="M-5.7,-1.85 L0,-6 L0,-13 L-12.37,-4.01 Z" fill={`url(#${creamId})`} />
          <path
            d="M0,-6 L5.7,-1.85 L3.53,4.85 L-3.53,4.85 L-5.7,-1.85 Z"
            fill={`url(#${greenId})`}
          />
          <path
            d="M0,-6 L5.7,-1.85 L3.53,4.85 L-3.53,4.85 L-5.7,-1.85 Z"
            fill="none"
            stroke="#1a3220"
            strokeWidth="0.4"
            opacity="0.5"
          />
          <path
            d="M0,-13 L12.37,-4.01 L7.64,10.52 L-7.64,10.52 L-12.37,-4.01 Z"
            fill="none"
            stroke="#3d2810"
            strokeWidth="0.5"
            opacity="0.35"
          />
        </g>

        {/* Velo suave para que la F resalte (como el Bitcoin sobre naranja liso) */}
        <circle cx="32" cy="32" r="32" fill="#F7931A" opacity="0.38" />
      </g>

      {/* «F» estilo Bitcoin (trazo grueso + doble barra vertical) */}
      <g fill="#FFFFFF" fillRule="evenodd">
        <rect x="21" y="17" width="5.5" height="30" rx="1" />
        <rect x="21" y="17" width="20" height="5.5" rx="1" />
        <rect x="21" y="28.5" width="16" height="5" rx="1" />
        <rect x="38.5" y="21" width="3.5" height="9" rx="0.8" />
        <rect x="38.5" y="34" width="3.5" height="9" rx="0.8" />
      </g>
    </svg>
  );
}
