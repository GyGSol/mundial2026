import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Solo variantes CSS — sin imágenes PNG en el shell del panel. */
export default function AdminBanner({ variant = 'auth', className }) {
  if (variant !== 'auth') return null;

  return (
    <div className={cn('admin-auth-hero', className)} aria-hidden>
      <div className="admin-auth-hero__icon">
        <ShieldCheck className="size-7" strokeWidth={2.25} />
      </div>
    </div>
  );
}
