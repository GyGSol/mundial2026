import { cn } from '@/lib/utils';

function CrestImage({ src, alt, className }) {
  if (!src) return null;
  return (
    <img
      src={src}
      alt={alt}
      className={cn('size-5 shrink-0 object-contain', className)}
      loading="lazy"
      onError={(e) => {
        e.currentTarget.style.display = 'none';
      }}
    />
  );
}

export function ClubCell({ club, clubCrestUrl, leagueEmblemUrl, leagueName }) {
  if (!club) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <span className="inline-flex items-center gap-2">
      <CrestImage src={clubCrestUrl} alt="" />
      <span>{club}</span>
      {leagueEmblemUrl ? (
        <CrestImage
          src={leagueEmblemUrl}
          alt={leagueName || 'Liga'}
          className="size-4 opacity-80"
        />
      ) : null}
    </span>
  );
}
