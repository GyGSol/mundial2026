import { cn } from '@/lib/utils';

const FOUL_ICON_SRC = '/icons/broken-leg-foul.png';

/**
 * Icono de pierna rota (generado) para faltas en la cronología del partido.
 */
export function BrokenLegIcon({ className, ...props }) {
  return (
    <img
      src={FOUL_ICON_SRC}
      alt=""
      width={16}
      height={16}
      className={cn('size-4 shrink-0 object-contain', className)}
      aria-hidden="true"
      {...props}
    />
  );
}
