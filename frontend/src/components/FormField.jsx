import { cn } from '@/lib/utils';

/**
 * Campo de formulario con label + hint de altura fija para alinear inputs en filas.
 */
export default function FormField({ label, hint, className, children }) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="min-h-10 space-y-1">
        <label className="block text-sm font-medium leading-tight">{label}</label>
        <p className="text-xs leading-snug text-muted-foreground">{hint || '\u00a0'}</p>
      </div>
      {children}
    </div>
  );
}
