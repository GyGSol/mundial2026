import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge.jsx';
import PlayerAvatar from '@/components/PlayerAvatar.jsx';
import { cn } from '@/lib/utils';
import PitchFormation from '@/components/lineup/PitchFormation.jsx';
import {
  countEventsWithoutCoords,
  pitchHighlightKeyForTimeline,
} from '@/components/lineup/PitchEventLayer.jsx';
import { eventHasPitchCoords } from '@/lib/pitchCoordinates.js';
import { applyLiveLineupState, normalizeLineupForPitch } from '@/lib/lineupLiveState.js';
import { applyGridOverridesToLineup } from '@/lib/adminFormationDebug.js';
import { formatSummaryPlayer } from '@/lib/playerPositionLabel.js';
import {
  resolveSubstitutionsForSide,
  shortPlayerName,
} from '@/lib/substitutionPhotos.js';

const HEATMAP_OPTIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'shots', label: 'Calor tiros' },
  { value: 'fouls', label: 'Calor faltas' },
  { value: 'goals', label: 'Calor goles' },
];

const HEATMAP_MODE_BY_EVENT_TYPE = {
  goal: 'goals',
  shot_attempt: 'shots',
  foul: 'fouls',
  yellow_card: 'fouls',
  red_card: 'fouls',
};

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

/** Cancha interactiva: eventos, calor y sync con la lista de acciones. */
export function shouldUseInteractivePitch(match, mode = 'default') {
  if (mode === 'live') return true;
  return (match?.matchTimeline?.length ?? 0) > 0;
}

/** Grid alineado: min | sale | nombre | → | entra | nombre | ↑ */
const SUB_ROW_GRID =
  'grid min-h-[3rem] w-full grid-cols-[1.75rem_1.75rem_minmax(0,1fr)_0.5rem_1.75rem_minmax(0,1fr)_1.15rem] items-center gap-x-1 px-2 py-1.5';

function substitutionOutLabel(sub) {
  return formatSummaryPlayer({
    name: sub.playerOut,
    position: sub.playerOutPosition,
    shirtNumber: sub.playerOutShirtNumber,
    positionX: sub.playerOutPositionX,
    positionY: sub.playerOutPositionY,
  });
}

function substitutionInLabel(sub) {
  return formatSummaryPlayer({
    name: sub.playerIn,
    position: sub.playerInPosition,
    shirtNumber: sub.playerInShirtNumber,
    positionX: sub.playerInPositionX,
    positionY: sub.playerInPositionY,
  });
}

function SubstitutionChangeRow({ sub, side, density = 'compact' }) {
  const ringClass = side === 'home' ? 'ring-sky-400/80' : 'ring-rose-400/80';
  const isSide = density === 'side';
  const avatarClass = isSide ? 'h-7 w-7' : 'h-5 w-5';
  const nameClass = isSide ? 'text-[10px] leading-tight' : 'text-[8px]';
  const minuteClass = isSide ? 'text-[10px]' : 'text-[9px]';
  const minuteLabel = sub.minute != null ? `${sub.minute}'` : '—';
  const outLabel = substitutionOutLabel(sub);
  const inLabel = substitutionInLabel(sub);

  const outAvatar = (
    <PlayerAvatar
      name={sub.playerOut}
      photoUrl={sub.playerOutPhotoUrl}
      size="xs"
      className={cn('shrink-0 grayscale opacity-70 ring-1', avatarClass, ringClass)}
    />
  );
  const inAvatar = (
    <PlayerAvatar
      name={sub.playerIn}
      photoUrl={sub.playerInPhotoUrl}
      size="xs"
      className={cn('shrink-0 ring-2 ring-emerald-500', avatarClass, ringClass)}
    />
  );
  const outName = (
    <span
      className={cn('min-w-0 truncate text-muted-foreground line-through', nameClass)}
      title={outLabel || sub.playerOut}
    >
      {outLabel || shortPlayerName(sub.playerOut)}
    </span>
  );
  const inName = (
    <span
      className={cn('min-w-0 truncate font-semibold text-emerald-800', nameClass)}
      title={inLabel || sub.playerIn}
    >
      {inLabel || shortPlayerName(sub.playerIn)}
    </span>
  );
  const inBadge = (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded bg-emerald-950 font-bold text-emerald-50',
        isSide ? 'h-4 w-4 text-[8px]' : 'px-0.5 text-[6px]'
      )}
    >
      ↑
    </span>
  );

  if (isSide) {
    return (
      <div className={cn(SUB_ROW_GRID, 'rounded-md border border-border/60 bg-muted/20')}>
        <span className={cn(minuteClass, 'tabular-nums text-muted-foreground')}>{minuteLabel}</span>
        {outAvatar}
        {outName}
        <span className="text-center text-[10px] text-muted-foreground">→</span>
        {inAvatar}
        {inName}
        {inBadge}
      </div>
    );
  }

  return (
    <div className="flex min-h-[2rem] w-full min-w-0 items-center gap-1 rounded-md border border-border/60 bg-muted/20 px-1.5 py-1">
      <span className={cn(minuteClass, 'shrink-0 tabular-nums text-muted-foreground')}>{minuteLabel}</span>
      <div className="flex min-w-0 flex-1 items-center gap-1">
        {outAvatar}
        {outName}
        <span className="shrink-0 text-[8px] text-muted-foreground">→</span>
        {inAvatar}
        {inName}
        {inBadge}
      </div>
    </div>
  );
}

function ExpulsionRow({ player, side, density = 'compact' }) {
  const ringClass = side === 'home' ? 'ring-sky-400/80' : 'ring-rose-400/80';
  const isSide = density === 'side';
  const avatarClass = isSide ? 'h-7 w-7' : 'h-5 w-5';
  const nameClass = isSide ? 'text-[10px] leading-tight' : 'text-[8px]';
  const minuteClass = isSide ? 'text-[10px]' : 'text-[9px]';
  const minuteLabel = player.expelledMinute != null ? `${player.expelledMinute}'` : '—';
  const label = formatSummaryPlayer({
    name: player.name,
    position: player.position ?? player.positionDetail,
    shirtNumber: player.shirtNumber,
  });

  return (
    <div
      className={cn(
        isSide
          ? 'grid min-h-[2.5rem] w-full grid-cols-[1.75rem_1.75rem_minmax(0,1fr)_1.15rem] items-center gap-x-1 rounded-md border border-red-200/80 bg-red-50/40 px-2 py-1.5'
          : 'flex min-h-[2rem] w-full min-w-0 items-center gap-1 rounded-md border border-red-200/80 bg-red-50/40 px-1.5 py-1'
      )}
    >
      <span className={cn(minuteClass, 'shrink-0 tabular-nums text-muted-foreground')}>{minuteLabel}</span>
      <PlayerAvatar
        name={player.name}
        photoUrl={player.photoUrl}
        size="xs"
        className={cn('shrink-0 ring-2 ring-red-500', avatarClass, ringClass)}
      />
      <span
        className={cn('min-w-0 truncate font-semibold text-red-900', nameClass)}
        title={label || player.name}
      >
        {label || shortPlayerName(player.name)}
      </span>
      {isSide ? (
        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-red-600 text-[8px] font-bold text-white">
          ↓
        </span>
      ) : (
        <span className="shrink-0 rounded bg-red-600 px-0.5 text-[6px] font-bold text-white">↓</span>
      )}
    </div>
  );
}

function SideLineupChangesColumn({
  teamName,
  subs = [],
  expulsions = [],
  side,
  className,
  align = 'start',
  density = 'compact',
}) {
  if (!subs.length && !expulsions.length) return null;

  return (
    <div
      className={cn(
        'flex w-full min-w-0 flex-col gap-1.5',
        align === 'end' && '[&>p]:text-right',
        className
      )}
    >
      {subs.length > 0 ? (
        <>
          <p
            className={cn(
              'font-semibold text-muted-foreground',
              density === 'side' ? 'text-[11px]' : 'text-[9px]'
            )}
          >
            {teamName} · cambios
          </p>
          {subs.map((sub, index) => (
            <SubstitutionChangeRow
              key={`${side}-sub-${sub.minute}-${sub.playerOut}-${index}`}
              sub={sub}
              side={side}
              density={density}
            />
          ))}
        </>
      ) : null}
      {expulsions.length > 0 ? (
        <>
          <p
            className={cn(
              'font-semibold text-red-800/90',
              density === 'side' ? 'text-[11px]' : 'text-[9px]',
              subs.length > 0 && 'mt-1'
            )}
          >
            {teamName} · expulsiones
          </p>
          {expulsions.map((player, index) => (
            <ExpulsionRow
              key={`${side}-exp-${player.shirtNumber}-${player.name}-${index}`}
              player={player}
              side={side}
              density={density}
            />
          ))}
        </>
      ) : null}
    </div>
  );
}

function SideLineupChangesPanel({ homeName, awayName, homeSubs = [], awaySubs = [], homeExpulsions = [], awayExpulsions = [] }) {
  const hasHome = homeSubs.length > 0 || homeExpulsions.length > 0;
  const hasAway = awaySubs.length > 0 || awayExpulsions.length > 0;
  if (!hasHome && !hasAway) return null;

  return (
    <div className="grid w-full max-w-lg grid-cols-1 gap-1.5 sm:grid-cols-2">
      {hasHome ? (
        <SideLineupChangesColumn
          teamName={homeName}
          subs={homeSubs}
          expulsions={homeExpulsions}
          side="home"
        />
      ) : null}
      {hasAway ? (
        <SideLineupChangesColumn
          teamName={awayName}
          subs={awaySubs}
          expulsions={awayExpulsions}
          side="away"
          align="end"
        />
      ) : null}
    </div>
  );
}

export default function MatchLineupSection({
  match,
  className,
  mode = 'default',
  events,
  highlightKey = null,
  onHighlightKeyChange,
  showLineupMeta = true,
  editablePitch = false,
  gridOverrides = null,
  onPlayerGridChange,
}) {
  const [heatmapMode, setHeatmapMode] = useState('normal');
  const pitchSectionRef = useRef(null);
  const syncedHighlightRef = useRef(null);
  const timelineEvents = events ?? match?.matchTimeline ?? [];
  const isInteractivePitch = shouldUseInteractivePitch(match, mode);
  const lineup = match?.lineup;
  const status = lineup?.status ?? 'unavailable';
  const homeName = match?.homeTeam?.nameEn || 'Local';
  const awayName = match?.awayTeam?.nameEn || 'Visitante';
  const timeLabel = updatedLabel(lineup?.updatedAt);

  const hydratedHomeSubs = useMemo(
    () =>
      resolveSubstitutionsForSide({
        substitutions: match?.homeSubstitutions ?? [],
        timeline: timelineEvents,
        lineupSide: lineup?.home,
        side: 'home',
      }),
    [match?.homeSubstitutions, timelineEvents, lineup?.home]
  );

  const hydratedAwaySubs = useMemo(
    () =>
      resolveSubstitutionsForSide({
        substitutions: match?.awaySubstitutions ?? [],
        timeline: timelineEvents,
        lineupSide: lineup?.away,
        side: 'away',
      }),
    [match?.awaySubstitutions, timelineEvents, lineup?.away]
  );

  const liveLineup = useMemo(() => {
    if (!isInteractivePitch || !lineup || status === 'unavailable') return lineup;
    return applyLiveLineupState(lineup, hydratedHomeSubs, hydratedAwaySubs, timelineEvents);
  }, [isInteractivePitch, lineup, status, hydratedHomeSubs, hydratedAwaySubs, timelineEvents]);

  const pitchLineup = useMemo(() => {
    const base = normalizeLineupForPitch(liveLineup ?? lineup);
    if (!gridOverrides || !Object.keys(gridOverrides).length) return base;
    return applyGridOverridesToLineup(base, gridOverrides);
  }, [liveLineup, lineup, gridOverrides]);

  const homeExpulsions = liveLineup?.home?.expelledPlayers ?? [];
  const awayExpulsions = liveLineup?.away?.expelledPlayers ?? [];

  const missingCoords = isInteractivePitch ? countEventsWithoutCoords(timelineEvents) : 0;

  useEffect(() => {
    if (!highlightKey || !isInteractivePitch) return;
    pitchSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [highlightKey, isInteractivePitch]);

  useEffect(() => {
    if (!highlightKey || !isInteractivePitch) {
      if (!highlightKey) {
        if (syncedHighlightRef.current) {
          syncedHighlightRef.current = null;
          setHeatmapMode('normal');
        } else {
          syncedHighlightRef.current = null;
        }
      }
      return;
    }
    if (syncedHighlightRef.current === highlightKey) return;
    syncedHighlightRef.current = highlightKey;

    const event = timelineEvents.find(
      (item) => pitchHighlightKeyForTimeline(item) === highlightKey
    );
    if (!event || !eventHasPitchCoords(event)) return;

    const suggestedMode = HEATMAP_MODE_BY_EVENT_TYPE[event.type];
    if (suggestedMode) setHeatmapMode(suggestedMode);
  }, [highlightKey, isInteractivePitch, timelineEvents]);

  function handleHeatmapModeChange(nextMode) {
    setHeatmapMode(nextMode);
    if (nextMode === 'normal') {
      syncedHighlightRef.current = null;
      onHighlightKeyChange?.(null);
    }
  }

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
  const showUnavailableBadge = status === 'unavailable' && isInteractivePitch;
  const showSidePanel =
    isInteractivePitch &&
    (hydratedHomeSubs.length > 0 ||
      hydratedAwaySubs.length > 0 ||
      homeExpulsions.length > 0 ||
      awayExpulsions.length > 0);
  const sideColumnClass = 'hidden w-[12.5rem] shrink-0 md:flex lg:w-[14rem]';

  return (
    <div
      className={cn('flex w-full flex-col items-center gap-2', className)}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <div className="flex flex-wrap items-center justify-center gap-2">
        {showLineupMeta ? (
          showUnavailableBadge ? (
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
          )
        ) : null}
        {showLineupMeta && timeLabel ? (
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

      <div
        ref={pitchSectionRef}
        className="flex w-full max-w-5xl flex-col items-center gap-2 md:flex-row md:items-start md:justify-center md:gap-2 lg:gap-3"
      >
        {showSidePanel ? (
          hydratedHomeSubs.length > 0 || homeExpulsions.length > 0 ? (
            <SideLineupChangesColumn
              teamName={homeName}
              subs={hydratedHomeSubs}
              expulsions={homeExpulsions}
              side="home"
              density="side"
              className={sideColumnClass}
            />
          ) : (
            <div className={cn(sideColumnClass, 'invisible')} aria-hidden />
          )
        ) : null}

        <PitchFormation
          lineup={pitchLineup}
          homeLabel={homeName}
          awayLabel={awayName}
          homeTeamCode={match?.homeTeam?.fifaCode}
          awayTeamCode={match?.awayTeam?.fifaCode}
          events={timelineEvents}
          heatmapMode={isInteractivePitch ? heatmapMode : 'normal'}
          highlightKey={highlightKey}
          onHighlightKeyChange={onHighlightKeyChange}
          showEventLayer={isInteractivePitch}
          className="w-full min-w-0 max-w-lg md:flex-1"
          draggablePlayers={editablePitch}
          showPositionGrid={editablePitch}
          onPlayerDragEnd={(payload) => {
            onPlayerGridChange?.(payload);
          }}
        />

        {showSidePanel ? (
          hydratedAwaySubs.length > 0 || awayExpulsions.length > 0 ? (
            <SideLineupChangesColumn
              teamName={awayName}
              subs={hydratedAwaySubs}
              expulsions={awayExpulsions}
              side="away"
              align="end"
              density="side"
              className={sideColumnClass}
            />
          ) : (
            <div className={cn(sideColumnClass, 'invisible')} aria-hidden />
          )
        ) : null}
      </div>

      {isInteractivePitch && !editablePitch ? (
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
              onClick={() => handleHeatmapModeChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}

      {showSidePanel ? (
        <div className="w-full md:hidden">
          <SideLineupChangesPanel
            homeName={homeName}
            awayName={awayName}
            homeSubs={hydratedHomeSubs}
            awaySubs={hydratedAwaySubs}
            homeExpulsions={homeExpulsions}
            awayExpulsions={awayExpulsions}
          />
        </div>
      ) : null}

      {isInteractivePitch && missingCoords > 0 ? (
        <p className="match-live-text-meta text-center text-[10px] text-muted-foreground">
          {missingCoords} evento{missingCoords === 1 ? '' : 's'} sin coordenadas espaciales FIFA
        </p>
      ) : null}
    </div>
  );
}
