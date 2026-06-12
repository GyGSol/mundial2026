import { adminPageHeaderClass } from './adminTheme.js';
import { cn } from '@/lib/utils';

export default function AdminPageHeader({ title, description, children, className }) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-3', adminPageHeaderClass, className)}>
      <div>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}
