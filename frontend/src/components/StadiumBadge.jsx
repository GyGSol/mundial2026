import { cn } from '@/lib/utils';
import { formatStadiumLine, getStadiumIconUrl } from '@/lib/stadiumMeta.js';

export default function StadiumBadge({ stadium, className, size = 'sm' }) {
  const iconUrl = getStadiumIconUrl(stadium);
  const line = formatStadiumLine(stadium);
  if (!iconUrl && !line) return null;

  const iconSize = size === 'xs' ? 'size-5' : 'size-6';

  return (
    <div
      className={cn(
        'flex items-center justify-center gap-2 text-muted-foreground',
        size === 'xs' ? 'text-[11px]' : 'text-xs',
        className
      )}
    >
      {iconUrl ? (
        <img
          src={iconUrl}
          alt=""
          title={line || stadium?.nameEn}
          loading="lazy"
          decoding="async"
          className={cn(iconSize, 'shrink-0 rounded-md border border-border/50 object-cover shadow-sm')}
        />
      ) : null}
      {line ? (
        <span className="min-w-0 text-center leading-snug" title={line}>
          {line}
        </span>
      ) : null}
    </div>
  );
}
