import { cn } from '@/lib/utils';

const sizeClass = {
  sm: 'h-5 w-5',
  md: 'h-7 w-7',
  lg: 'h-12 w-12',
};

export default function FubolCoinIcon({ size = 'md', className, alt = 'Fubol' }) {
  return (
    <img
      src="/fubol-coin.png"
      alt={alt}
      className={cn('shrink-0 object-contain drop-shadow-sm', sizeClass[size] || sizeClass.md, className)}
      draggable={false}
    />
  );
}
