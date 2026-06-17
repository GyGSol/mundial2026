import { cn } from '@/lib/utils';

const sizeClass = {
  sm: 'h-5 w-5',
  md: 'h-7 w-7',
  lg: 'h-12 w-12',
};

/** Logo Fubol: moneda dorada/azul con pelota de trapo (PNG transparente). */
export default function FubolCoinIcon({ size = 'md', className, alt = 'Fubol' }) {
  return (
    <img
      src="/fubol-coin.png"
      alt={alt}
      width={64}
      height={64}
      className={cn(
        'inline-block shrink-0 rounded-full object-contain transition-transform duration-200 ease-out hover:scale-[1.28] motion-reduce:transition-none motion-reduce:hover:scale-100',
        sizeClass[size] || sizeClass.md,
        className
      )}
      draggable={false}
    />
  );
}
