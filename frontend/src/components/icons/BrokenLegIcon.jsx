import { cn } from '@/lib/utils';

/**
 * Pierna rota estilizada para faltas en la cronología del partido.
 */
export function BrokenLegIcon({ className, ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-3 shrink-0', className)}
      aria-hidden="true"
      {...props}
    >
      {/* Muslo */}
      <path d="M11 3v7.5" />
      {/* Fractura en zigzag */}
      <path d="M11 10.5 9 12.5 12 14 10 16" />
      {/* Espinilla desplazada */}
      <path d="M10 16 13.5 20.5" />
      {/* Pie */}
      <path d="M11.5 20.5h4.5" />
      {/* Rodilla */}
      <circle cx="11" cy="10.5" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  );
}
