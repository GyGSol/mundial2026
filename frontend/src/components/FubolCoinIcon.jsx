import { useId } from 'react';
import { cn } from '@/lib/utils';

const sizeClass = {
  sm: 'h-5 w-5',
  md: 'h-7 w-7',
  lg: 'h-12 w-12',
};

/** Moneda acuñada con pelota de trapo en relieve (sin halo exterior). */
export default function FubolCoinIcon({ size = 'md', className, alt = 'Fubol' }) {
  const uid = useId().replace(/:/g, '');
  const faceId = `fubol-face-${uid}`;
  const rimId = `fubol-rim-${uid}`;
  const recessId = `fubol-recess-${uid}`;
  const creamId = `fubol-cream-${uid}`;
  const greenId = `fubol-green-${uid}`;
  const canvasId = `fubol-canvas-${uid}`;
  const corduroyId = `fubol-corduroy-${uid}`;

  const stitch = {
    stroke: '#4a3020',
    strokeWidth: 0.35,
    strokeLinejoin: 'round',
  };

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
        <radialGradient id={faceId} cx="36%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#f2dc82" />
          <stop offset="50%" stopColor="#c9a227" />
          <stop offset="100%" stopColor="#6f5210" />
        </radialGradient>
        <linearGradient id={rimId} x1="10%" y1="8%" x2="92%" y2="94%">
          <stop offset="0%" stopColor="#d4af37" />
          <stop offset="45%" stopColor="#8b6914" />
          <stop offset="100%" stopColor="#3d2d06" />
        </linearGradient>
        <radialGradient id={recessId} cx="50%" cy="48%" r="50%">
          <stop offset="0%" stopColor="#a67c1a" />
          <stop offset="100%" stopColor="#5c4510" />
        </radialGradient>
        <linearGradient id={creamId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f3ead8" />
          <stop offset="55%" stopColor="#e0d0b4" />
          <stop offset="100%" stopColor="#b9a484" />
        </linearGradient>
        <linearGradient id={greenId} x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="#4a7a52" />
          <stop offset="50%" stopColor="#2d5a34" />
          <stop offset="100%" stopColor="#1e3d24" />
        </linearGradient>
        <pattern id={canvasId} width="3" height="3" patternUnits="userSpaceOnUse">
          <path d="M0 3 L3 0" stroke="#c4b49a" strokeWidth="0.35" opacity="0.45" />
        </pattern>
        <pattern id={corduroyId} width="2.5" height="3" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="3" stroke="#1a3220" strokeWidth="0.9" opacity="0.28" />
        </pattern>
      </defs>

      {/* Borde de moneda */}
      <circle cx="32" cy="32" r="30" fill={`url(#${rimId})`} />
      <circle cx="32" cy="32" r="27" fill={`url(#${faceId})`} />

      {/* Cámara acuñada donde asienta la pelota */}
      <circle cx="32" cy="33" r="17.5" fill={`url(#${recessId})`} />
      <circle
        cx="32"
        cy="33"
        r="17.5"
        fill="none"
        stroke="#2a1f08"
        strokeOpacity="0.25"
        strokeWidth="0.6"
      />

      {/* Pelota de trapo — relieve acuñado */}
      <g transform="translate(32,33)">
        {/* Parches de trapo (beige) */}
        <path
          d="M0,-6 L5.7,-1.85 L12.37,-4.01 L0,-13 Z"
          fill={`url(#${creamId})`}
          {...stitch}
        />
        <path
          d="M5.7,-1.85 L3.53,4.85 L7.64,10.52 L12.37,-4.01 Z"
          fill={`url(#${creamId})`}
          {...stitch}
        />
        <path
          d="M3.53,4.85 L-3.53,4.85 L-7.64,10.52 L7.64,10.52 Z"
          fill={`url(#${creamId})`}
          {...stitch}
        />
        <path
          d="M-3.53,4.85 L-5.7,-1.85 L-12.37,-4.01 L-7.64,10.52 Z"
          fill={`url(#${creamId})`}
          {...stitch}
        />
        <path
          d="M-5.7,-1.85 L0,-6 L0,-13 L-12.37,-4.01 Z"
          fill={`url(#${creamId})`}
          {...stitch}
        />

        {/* Textura tela sobre parches beige */}
        <path d="M0,-6 L5.7,-1.85 L12.37,-4.01 L0,-13 Z" fill={`url(#${canvasId})`} />
        <path d="M5.7,-1.85 L3.53,4.85 L7.64,10.52 L12.37,-4.01 Z" fill={`url(#${canvasId})`} />
        <path d="M3.53,4.85 L-3.53,4.85 L-7.64,10.52 L7.64,10.52 Z" fill={`url(#${canvasId})`} />
        <path d="M-3.53,4.85 L-5.7,-1.85 L-12.37,-4.01 L-7.64,10.52 Z" fill={`url(#${canvasId})`} />
        <path d="M-5.7,-1.85 L0,-6 L0,-13 L-12.37,-4.01 Z" fill={`url(#${canvasId})`} />

        {/* Manchas de uso */}
        <ellipse cx="2" cy="-9" rx="2.2" ry="1.4" fill="#8b6b4a" opacity="0.32" />
        <ellipse cx="-6" cy="6" rx="1.8" ry="1.2" fill="#7a5c3e" opacity="0.28" />
        <ellipse cx="8" cy="2" rx="1.5" ry="1" fill="#8b6b4a" opacity="0.22" />

        {/* Pentágono central (pana verde) */}
        <path
          d="M0,-6 L5.7,-1.85 L3.53,4.85 L-3.53,4.85 L-5.7,-1.85 Z"
          fill={`url(#${greenId})`}
          {...stitch}
        />
        <path
          d="M0,-6 L5.7,-1.85 L3.53,4.85 L-3.53,4.85 L-5.7,-1.85 Z"
          fill={`url(#${corduroyId})`}
        />

        {/* Costuras destacadas */}
        <path
          d="M0,-6 L5.7,-1.85 L3.53,4.85 L-3.53,4.85 L-5.7,-1.85 Z"
          fill="none"
          stroke="#f5e8c8"
          strokeWidth="0.2"
          strokeOpacity="0.45"
        />
        <path
          d="M0,-13 L12.37,-4.01 L7.64,10.52 L-7.64,10.52 L-12.37,-4.01 Z"
          fill="none"
          stroke="#2a1a0c"
          strokeWidth="0.45"
          strokeOpacity="0.35"
        />

        {/* Hilos sueltos */}
        <path d="M0,-13 L0.6,-14.2" stroke="#d8cbb0" strokeWidth="0.25" strokeLinecap="round" />
        <path d="M12.37,-4.01 L13.2,-3.2" stroke="#d8cbb0" strokeWidth="0.22" strokeLinecap="round" />
        <path d="M-12.37,-4.01 L-13.1,-3.3" stroke="#d8cbb0" strokeWidth="0.22" strokeLinecap="round" />
      </g>

      {/* Surco y bisel de moneda */}
      <circle
        cx="32"
        cy="32"
        r="24.5"
        fill="none"
        stroke="#f5e6a8"
        strokeOpacity="0.22"
        strokeWidth="0.5"
      />
      <circle
        cx="32"
        cy="32"
        r="24.5"
        fill="none"
        stroke="#2a1f08"
        strokeOpacity="0.35"
        strokeWidth="0.75"
      />

      {/* Leyenda acuñada en el borde */}
      <text
        x="32"
        y="52"
        textAnchor="middle"
        fontSize="5.5"
        fontWeight="700"
        fontFamily="system-ui, -apple-system, 'Segoe UI', sans-serif"
        letterSpacing="1.2"
        fill="#3d2d06"
        stroke="#e8c96a"
        strokeWidth="0.2"
        paintOrder="stroke"
        opacity="0.9"
      >
        FUBOL
      </text>
    </svg>
  );
}
