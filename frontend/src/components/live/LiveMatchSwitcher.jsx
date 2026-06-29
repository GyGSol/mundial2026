import { cn } from '@/lib/utils';
import TeamFlag from '@/components/TeamFlag.jsx';
import { resolveFieldMatchScores } from '@/lib/matchDisplayScore.js';

function SwitcherChip({ match, active, onSelect }) {
  const homeName = match?.homeTeam?.nameEn || 'Local';
  const awayName = match?.awayTeam?.nameEn || 'Visitante';
  const { homeScore, awayScore } = resolveFieldMatchScores(match);

  return (
    <button
      type="button"
      onClick={() => onSelect(match.id)}
      className={cn(
        'flex min-w-0 items-center gap-1.5 rounded-md border px-2 py-1 text-left text-[11px] transition-colors',
        active
          ? 'border-primary bg-primary/10 text-foreground'
          : 'border-border/70 bg-muted/30 text-muted-foreground hover:bg-muted/60'
      )}
    >
      <TeamFlag team={match?.homeTeam} className="!size-3.5" sizeClass="size-3.5" />
      <span className="truncate font-medium">{homeName}</span>
      <span className="shrink-0 tabular-nums">
        {homeScore}-{awayScore}
      </span>
      <span className="truncate font-medium">{awayName}</span>
      <TeamFlag team={match?.awayTeam} className="!size-3.5" sizeClass="size-3.5" />
      {match?.timeElapsed ? (
        <span className="shrink-0 text-[10px] text-red-600 dark:text-red-400">{match.timeElapsed}</span>
      ) : null}
    </button>
  );
}

export default function LiveMatchSwitcher({ matches = [], activeMatchId, onSelect, className }) {
  if (matches.length <= 1) return null;

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {matches.map((match) => (
        <SwitcherChip
          key={match.id}
          match={match}
          active={match.id === activeMatchId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
