import { Badge } from '@/components/ui/badge.jsx';
import { cn } from '@/lib/utils';
import PitchFormation from '@/components/lineup/PitchFormation.jsx';

function formationLine(side) {
  if (!side?.formation) return null;
  return side.formation;
}

function updatedLabel(updatedAt) {
  if (!updatedAt) return null;
  try {
    return new Intl.DateTimeFormat('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(updatedAt));
  } catch {
    return null;
  }
}

export default function MatchLineupSection({ match, className }) {
  const lineup = match?.lineup;
  const status = lineup?.status ?? 'unavailable';
  const homeName = match?.homeTeam?.nameEn || 'Local';
  const awayName = match?.awayTeam?.nameEn || 'Visitante';
  const timeLabel = updatedLabel(lineup?.updatedAt);

  if (status === 'unavailable') {
    return (
      <p className={cn('match-live-text-meta text-center text-[11px] text-muted-foreground', className)}>
        Alineación disponible ~1 h antes del partido
      </p>
    );
  }

  const isConfirmed = status === 'confirmed';
  const homeFormation = formationLine(lineup.home);
  const awayFormation = formationLine(lineup.away);

  return (
    <div
      className={cn('flex w-full flex-col items-center gap-2', className)}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Badge
          variant="outline"
          className={cn(
            isConfirmed
              ? 'border-emerald-300/70 bg-emerald-50 text-emerald-900'
              : 'border-violet-300/70 bg-violet-50 text-violet-900'
          )}
        >
          {isConfirmed ? 'Alineación confirmada' : 'Alineación probable'}
        </Badge>
        {timeLabel ? (
          <span className="match-live-text-meta text-[10px] text-muted-foreground">
            Actualizada {timeLabel}
          </span>
        ) : null}
      </div>

      {(homeFormation || awayFormation) ? (
        <p className="match-live-text-meta text-center text-[10px] text-muted-foreground">
          {homeFormation ? `${homeName} ${homeFormation}` : homeName}
          {' · '}
          {awayFormation ? `${awayName} ${awayFormation}` : awayName}
        </p>
      ) : null}

      <PitchFormation
        lineup={lineup}
        homeLabel={homeName}
        awayLabel={awayName}
        homeTeamCode={match?.homeTeam?.fifaCode}
        awayTeamCode={match?.awayTeam?.fifaCode}
      />
    </div>
  );
}
