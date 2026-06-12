import AdminBanner from './AdminBanner.jsx';
import { adminCard, adminCardAccent } from './adminTheme.js';
import { cn } from '@/lib/utils';

export default function AdminCard({
  accent = false,
  bannerVariant,
  title,
  header,
  children,
  className,
  contentClassName,
  flush,
}) {
  const hasHeader = title || header;

  return (
    <div className={cn(accent ? adminCardAccent : adminCard, className)}>
      {bannerVariant === 'auth' ? <AdminBanner variant="auth" /> : null}
      {hasHeader ? (
        <div className={cn('admin-card__header', flush && 'px-4 pt-4')}>
          {header ?? <h3 className="admin-card__title">{title}</h3>}
        </div>
      ) : null}
      <div
        className={cn(
          'admin-card__body',
          flush && 'admin-card__body--flush',
          !hasHeader && flush && 'p-0',
          contentClassName
        )}
      >
        {children}
      </div>
    </div>
  );
}
