import { useState } from 'react';
import { cn } from '@/lib/utils';
import { formatStadiumLine, getStadiumIconUrl } from '@/lib/stadiumMeta.js';
import StadiumDetailDialog from '@/components/StadiumDetailDialog.jsx';

export default function StadiumBadge({ stadium, className, size = 'sm' }) {
  const [open, setOpen] = useState(false);
  const iconUrl = getStadiumIconUrl(stadium);
  const line = formatStadiumLine(stadium);
  if (!iconUrl && !line) return null;

  const iconSize = size === 'xs' ? 'size-7' : 'size-8';
  const label = line || stadium?.nameEn || 'Estadio';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Ver datos de ${label}`}
        className={cn(
          'flex max-w-full items-center gap-2 rounded-md text-left text-muted-foreground transition-colors',
          'hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          size === 'xs' ? 'text-[11px]' : 'text-xs',
          className
        )}
      >
        {iconUrl ? (
          <img
            src={iconUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className={cn(
              iconSize,
              'shrink-0 rounded-full border border-border/60 object-cover shadow-sm'
            )}
          />
        ) : null}
        {line ? (
          <span className="min-w-0 leading-snug underline-offset-2 hover:underline">
            {line}
          </span>
        ) : null}
      </button>

      <StadiumDetailDialog stadium={stadium} open={open} onOpenChange={setOpen} />
    </>
  );
}
