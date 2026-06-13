import { KnockoutSlotLabel } from '@/components/worldcup/GroupColorUi.jsx';
import { getTeamFlag, getWorldCupTitles } from '@/lib/teamMeta';

function WorldCupStars({ count }) {
  return (
    <div
      className="flex h-5 w-full items-center justify-center gap-0.5 text-amber-500"
      aria-label={count ? `${count} copa${count === 1 ? '' : 's'} del mundo` : undefined}
      aria-hidden={count ? undefined : true}
    >
      {count > 0 &&
        Array.from({ length: count }).map((_, i) => (
          <span key={i} className="text-xs leading-none md:text-sm">
            ★
          </span>
        ))}
    </div>
  );
}

export default function TeamHeader({ team, slotLabel }) {
  if (!team && slotLabel) {
    return (
      <div className="flex flex-col items-center gap-1 px-1 text-center">
        <KnockoutSlotLabel label={slotLabel} className="text-xs sm:text-sm" />
      </div>
    );
  }

  const name = team?.nameEn || team?.externalId || '—';
  const flagUrl = getTeamFlag(team);
  const titles = getWorldCupTitles(team?.fifaCode);

  return (
    <div className="flex flex-col items-center gap-1 text-center">
      {flagUrl ? (
        <img
          src={flagUrl}
          alt={`Bandera de ${name}`}
          className="size-10 shrink-0 rounded-sm border border-border/60 object-cover shadow-sm md:size-12 lg:size-14"
          loading="lazy"
        />
      ) : (
        <div className="flex size-10 shrink-0 items-center justify-center rounded-sm border border-border/60 bg-muted text-xs text-muted-foreground md:size-12 lg:size-14">
          ?
        </div>
      )}

      <WorldCupStars count={titles} />

      <p className="line-clamp-2 min-h-[2.5rem] max-w-full text-sm font-semibold leading-tight md:min-h-[3rem] md:text-base lg:text-lg">
        {name}
      </p>
    </div>
  );
}
