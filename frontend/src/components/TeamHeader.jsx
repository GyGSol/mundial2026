import { KnockoutSlotLabel } from '@/components/worldcup/GroupColorUi.jsx';
import { FifaRankingIcon } from '@/components/icons/FifaRankingIcon.jsx';
import { getFifaRankingForTeam, getWorldCupTitles } from '@/lib/teamMeta';
import TeamFlag from './TeamFlag.jsx';

function FifaRankingLabel({ team }) {
  const ranking = getFifaRankingForTeam(team);
  if (!ranking?.rank) return null;

  return (
    <p
      className="inline-flex items-center justify-center gap-1 text-[10px] font-semibold tabular-nums text-muted-foreground md:text-xs"
      title={ranking.asOf ? `Ranking FIFA actualizado al ${ranking.asOf}` : 'Ranking FIFA'}
      aria-label={`Ranking FIFA ${ranking.rank}`}
    >
      <FifaRankingIcon />
      <span>{ranking.rank}</span>
    </p>
  );
}

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

export default function TeamHeader({ team, slotLabel, slotSourceMatch }) {
  if (!team && (slotLabel || slotSourceMatch)) {
    return (
      <div className="flex flex-col items-center gap-1 px-1 text-center">
        <KnockoutSlotLabel
          label={slotLabel}
          slotSourceMatch={slotSourceMatch}
          className="text-xs sm:text-sm"
        />
      </div>
    );
  }

  const name = team?.nameEn || team?.externalId || '—';
  const titles = getWorldCupTitles(team?.fifaCode);

  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <FifaRankingLabel team={team} />
      <TeamFlag team={team} />

      <WorldCupStars count={titles} />

      <p className="line-clamp-2 min-h-[2.5rem] max-w-full text-sm font-semibold leading-tight md:min-h-[3rem] md:text-base lg:text-lg">
        {name}
      </p>
    </div>
  );
}
