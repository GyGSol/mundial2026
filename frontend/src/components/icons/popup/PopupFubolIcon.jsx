import { cn } from '@/lib/utils';

/** Icono Fubol unificado para títulos y encabezados de popup. */
export function PopupFubolIcon({ className, title, alt = 'Fubol', ...props }) {
  return (
    <img
      src="/fubol-coin.png"
      alt={alt}
      width={32}
      height={32}
      draggable={false}
      className={cn('inline-block shrink-0 rounded-full object-contain', className)}
      title={title}
      {...props}
    />
  );
}
