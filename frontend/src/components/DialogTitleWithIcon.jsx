import { CardTitle } from '@/components/ui/card.jsx';
import { cn } from '@/lib/utils';

/**
 * Título de popup con icono cartoon a la izquierda.
 */
export default function DialogTitleWithIcon({
  icon: Icon,
  id,
  className,
  titleClassName,
  iconClassName,
  iconLabel,
  children,
}) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <Icon
        className={cn('size-8 shrink-0', iconClassName)}
        aria-hidden="true"
        title={iconLabel}
      />
      <CardTitle id={id} className={titleClassName}>
        {children}
      </CardTitle>
    </div>
  );
}
