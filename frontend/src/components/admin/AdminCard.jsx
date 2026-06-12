import AdminBanner from './AdminBanner.jsx';
import { adminCard } from './adminTheme.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { cn } from '@/lib/utils';

export default function AdminCard({
  banner,
  bannerVariant,
  title,
  header,
  children,
  className,
  contentClassName,
  flush,
}) {
  const hasHeader = title || header;

  const hasBanner = Boolean(banner || bannerVariant);

  return (
    <Card
      className={cn(
        adminCard,
        (flush || hasBanner) && 'overflow-hidden py-0 gap-0',
        className
      )}
    >
      {banner ? <AdminBanner src={banner} /> : null}
      {bannerVariant ? <AdminBanner variant={bannerVariant} /> : null}
      {hasHeader ? (
        <CardHeader className={flush ? 'px-4 pt-4' : undefined}>
          {header ?? <CardTitle className="text-base">{title}</CardTitle>}
        </CardHeader>
      ) : null}
      <CardContent className={cn(flush && !hasHeader && 'p-0', contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}
