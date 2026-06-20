import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge.jsx';
import { cn } from '@/lib/utils';
import PitchFormation from '@/components/lineup/PitchFormation.jsx';
import { countEventsWithoutCoords } from '@/components/lineup/PitchEventLayer.jsx';
import { applyLiveSubstitutions } from '@/lib/lineupLiveState.js';

const HEATMAP_OPTIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'shots', label: 'Calor tiros' },
  { value: 'fouls', label: 'Calor faltas' },
  { value: 'goals', label: 'Calor goles' },
];

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

export function shouldShowMatchLineup(match) {
  const status = match?.lineup?.status;
  if (status && status !== 'unavailable') return true;
  return (match?.matchTimeline?.length ?? 0) > 0;
}

export default function MatchLineupSection({
  match,
  className,
  mode = 'default',
  events,
  highlightKey = null,
  onHighlightKeyChange,
}) {
  const [heatmapMode, setHeatmapMode] = useState('normal');
  const timelineEvents = events ?? match?.matchTimeline ?? [];
  const isLiveMode = mode === 'live';
  const lineup = match?.lineup;
  const status = lineup?.status ?? 'unavailable';
  const homeName = match?.homeTeam?.nameEn || 'Local';
  const awayName = match?.awayTeam?.nameEn || 'Visitante';
  const timeLabel = updatedLabel(lineup?.updatedAt);

  const liveLineup = useMemo(() => {
    if (!isLiveMode || !lineup || status === 'unavailable') return lineup;
    return applyLiveSubstitutions(
      lineup,
      match?.homeSubstitutions ?? [],
      match?.awaySubstitutions ?? []
    );
  }, [isLiveMode, lineup, status, match?.homeSubstitutions, match?.awaySubstitutions]);

  const missingCoords = isLiveMode ? countEventsWithoutCoords(timelineEvents) : 0;

  if (!shouldShowMatchLineup(match)) {
    return (
      <p className={cn('match-live-text-meta text-center text-[11px] text-muted-foreground', className)}>
        Alineación disponible ~1 h antes del partido
      </p>
    );
  }

  const isConfirmed = status === 'confirmed';
  const homeFormation = formationLine(liveLineup?.home ?? lineup?.home);
  const awayFormation = formationLine(liveLineup?.away ?? lineup?.away);
  const showUnavailableBadge = status === 'unavailable' && isLiveMode;

  return (
    <div
      className={cn('flex w-full flex-col items-center gap-2', className)}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <div className="flex flex-wrap items-center justify-center gap-2">
        {showUnavailableBadge ? (
          <Badge variant="outline" className="border-muted-foreground/40 bg-muted/40 text-muted-foreground">
            Sin alineación · solo eventos
          </Badge>
        ) : (
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
        )}
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

      {isLiveMode ? (
        <div className="flex flex-wrap items-center justify-center gap-1">
          {HEATMAP_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={cn(
                'rounded-full border px-2 py-0.5 text-[10px] transition',
                heatmapMode === option.value
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-border bg-background text-muted-foreground hover:bg-muted/50'
              )}
              onClick={() => setHeatmapMode(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}

      <PitchFormation
        lineup={liveLineup ?? lineup}
        homeLabel={homeName}
        awayLabel={awayName}
        homeTeamCode={match?.homeTeam?.fifaCode}
        awayTeamCode={match?.awayTeam?.fifaCode}
        events={timelineEvents}
        heatmapMode={isLiveMode ? heatmapMode : 'normal'}
        highlightKey={highlightKey}
        onHighlightKeyChange={onHighlightKeyChange}
        showEventLayer={isLiveMode}
      />

      {isLiveMode && missingCoords > 0 ? (
        <p className="match-live-text-meta text-center text-[10px] text-muted-foreground">
          {missingCoords} evento{missingCoords === 1 ? '' : 's'} sin coordenadas espaciales FIFA
        </p>
      ) : null}
    </div>
  );
}
