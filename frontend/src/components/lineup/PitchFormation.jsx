import { useMemo, useState } from 'react';
import PlayerAvatar from '@/components/PlayerAvatar.jsx';
import PlayerDetailDialog from '@/components/PlayerDetailDialog.jsx';
import CoachDetailDialog from '@/components/lineup/CoachDetailDialog.jsx';
import PitchEventPinInteractions, {
  PitchEventPinVisuals,
} from '@/components/lineup/PitchEventLayer.jsx';
import PitchHeatmapLayer from '@/components/lineup/PitchHeatmapLayer.jsx';
import { inferTacticalPosition } from '@/lib/playerPositionLabel.js';
import {
  buildPlayerEventSummary,
  playerKeyFromLineupPlayer,
  playerMatchesPitchHighlight,
} from '@/lib/lineupLiveState.js';
import { cn } from '@/lib/utils';
import { getTeamFlag } from '@/lib/teamMeta.js';
import { getTeamPitchPalette } from '@/lib/teamPitchColors.js';
import { lineupGridToHalfPitchPercent } from '@/lib/pitchCoordinates.js';
import { resolvePitchFormationLayers } from '@/lib/pitchFormationDisplay.js';

function shortName(fullName) {
  const parts = String(fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0].slice(0, 9);
  return parts[parts.length - 1].slice(0, 11);
}

function lineupPositionLabel(player) {
  return (
    inferTacticalPosition({
      position: player.position,
      positionX: player.gridX,
      positionY: player.gridY,
    }) ?? player.position
  );
}

function formatHoverDetail(player, position) {
  const parts = [
    position,
    player.shirtNumber != null ? `#${player.shirtNumber}` : null,
    player.name,
  ].filter(Boolean);
  return parts.join(' · ');
}

function PitchPlayerHoverCard({ player, position, teamCode, side }) {
  const palette = getTeamPitchPalette(teamCode, side);
  const flagUrl = getTeamFlag({ fifaCode: teamCode });

  return (
    <div
      className={cn(
        'match-live-action-card w-max min-w-[9.5rem] max-w-[13rem] overflow-hidden rounded-md border bg-card text-left shadow-md',
        palette.cardBorder
      )}
    >
      <div
        className={cn(
          'match-live-action-header flex items-center justify-between gap-2 px-2 py-1',
          palette.header,
          palette.headerText
        )}
      >
        <span className="inline-flex min-w-0 items-center gap-1 text-[10px] font-semibold">
          {flagUrl ? (
            <img src={flagUrl} alt="" className="size-3 shrink-0 rounded-sm border border-white/25 object-cover" />
          ) : null}
          <span className="truncate">{teamCode || (side === 'home' ? 'Local' : 'Visit')}</span>
        </span>
        <span className={cn('shrink-0 text-[10px] font-medium', palette.meta)}>{position}</span>
      </div>

      <div className="match-live-action-body px-2 py-1.5">
        <div className="match-live-action-player flex min-w-0 items-center gap-1.5">
          <PlayerAvatar
            name={player.name}
            photoUrl={player.photoUrl}
            size="xs"
            variant="portrait"
            className={cn(
              'max-h-7 max-w-[1.375rem] shrink-0 shadow-sm ring-1 sm:max-h-9 sm:max-w-[1.75rem]',
              palette.avatarRing
            )}
          />
          <div className="grid min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-1 text-[9px] leading-tight">
            <span className={cn('tabular-nums font-semibold', palette.number)}>
              {player.shirtNumber != null ? player.shirtNumber : '—'}
            </span>
            <span className="min-w-0 truncate font-medium text-foreground">{player.name}</span>
          </div>
        </div>
        {player.positionDetail ? (
          <p className="mt-1 text-[8px] text-muted-foreground">{player.positionDetail}</p>
        ) : null}
      </div>

      <div className={cn('border-t px-2 py-1 text-center text-[8px]', palette.footer)}>
        Clic para ver ficha
      </div>
    </div>
  );
}

function teamDotStyle(player, side) {
  return lineupGridToHalfPitchPercent(player.gridX, player.gridY, side);
}

function PlayerBadges({ summary, hideSubstitutionBadge = false }) {
  if (!summary) return null;
  const hasGoals = summary.goals > 0;
  const hasCards = summary.yellow > 0 || summary.red > 0;
  const hasSub =
    !hideSubstitutionBadge &&
    (summary.subOffMinute != null || summary.subInMinute != null);
  if (!hasGoals && !hasCards && !hasSub) return null;

  return (
    <div className="absolute -right-1 -top-1 z-20 flex flex-col items-end gap-px">
      {hasGoals ? (
        <span className="rounded bg-emerald-600 px-0.5 text-[6px] font-bold leading-none text-white">
          {'⚽'.repeat(Math.min(summary.goals, 3))}
        </span>
      ) : null}
      {summary.yellow > 0 ? (
        <span className="h-2 w-1.5 rounded-sm bg-yellow-400 ring-1 ring-yellow-200" aria-label="Tarjeta amarilla" />
      ) : null}
      {summary.red > 0 ? (
        <span className="h-2 w-1.5 rounded-sm bg-red-500 ring-1 ring-red-200" aria-label="Tarjeta roja" />
      ) : null}
      {hasSub ? (
        <span className="rounded bg-violet-700 px-0.5 text-[6px] font-bold leading-none text-white">↕</span>
      ) : null}
    </div>
  );
}

function PlayerMarker({
  player,
  side,
  index,
  teamCode,
  onPlayerClick,
  eventSummary,
  highlightKey,
  onPlayerHighlight,
  timelineEvents = [],
}) {
  const label = shortName(player.name);
  const number = player.shirtNumber;
  const position = lineupPositionLabel(player);
  const style = teamDotStyle(player, side);
  const ringClass = side === 'home' ? 'ring-sky-400/80' : 'ring-rose-400/80';
  const hoverDetail = formatHoverDetail(player, position);
  const playerKey = playerKeyFromLineupPlayer(player, side);
  const isHighlighted = playerMatchesPitchHighlight(player, side, highlightKey, timelineEvents);

  return (
    <div
      key={player.playerId ?? `${side}-${index}`}
      className="group/marker pointer-events-auto absolute z-20 -translate-x-1/2 -translate-y-1/2 group-hover/marker:z-[60] group-focus-within/marker:z-[60]"
      style={style}
    >
      <button
        type="button"
        className={cn(
          'relative flex flex-col items-center gap-px rounded-md p-px transition hover:bg-black/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60',
          isHighlighted && 'ring-2 ring-white/90 ring-offset-1 ring-offset-emerald-900'
        )}
        onClick={(event) => {
          event.stopPropagation();
          onPlayerHighlight?.(isHighlighted ? null : playerKey);
          onPlayerClick?.({
            ...player,
            position,
            teamSide: side,
            teamFifaCode: teamCode,
          });
        }}
        aria-label={`Ver ficha de ${player.name}`}
      >
        <PlayerBadges summary={eventSummary} hideSubstitutionBadge={player.subbedIn} />

        <div className="relative flex flex-col items-center">
          {position ? (
            <span className="absolute -top-[0.45rem] left-1/2 z-10 flex -translate-x-1/2 items-center gap-0.5 whitespace-nowrap sm:-top-[0.55rem]">
              <span className="rounded-sm bg-black/75 px-0.5 text-[5px] font-semibold leading-none text-white/95 sm:text-[6px]">
                {position}
              </span>
              {player.subbedIn ? (
                <span
                  className="inline-flex h-[0.65rem] min-w-[0.65rem] shrink-0 items-center justify-center rounded-sm bg-emerald-500 px-px text-[7px] font-black leading-none text-white shadow-[0_0_0_1px_rgba(255,255,255,0.95)] sm:h-[0.75rem] sm:min-w-[0.75rem] sm:text-[8px]"
                  aria-label="Entró al partido"
                  title={player.subMinute != null ? `Entró ${player.subMinute}'` : 'Suplente en cancha'}
                >
                  ↑
                </span>
              ) : null}
            </span>
          ) : player.subbedIn ? (
            <span
              className="absolute -top-[0.45rem] left-1/2 z-10 inline-flex h-[0.65rem] min-w-[0.65rem] -translate-x-1/2 items-center justify-center rounded-sm bg-emerald-500 px-px text-[7px] font-black leading-none text-white shadow-[0_0_0_1px_rgba(255,255,255,0.95)] sm:-top-[0.55rem] sm:h-[0.75rem] sm:min-w-[0.75rem] sm:text-[8px]"
              aria-label="Entró al partido"
              title={player.subMinute != null ? `Entró ${player.subMinute}'` : 'Suplente en cancha'}
            >
              ↑
            </span>
          ) : null}

          <PlayerAvatar
            name={player.name}
            photoUrl={player.photoUrl}
            size="xs"
            className={cn('h-5 w-5 shadow-sm ring-1 sm:h-6 sm:w-6', ringClass)}
          />
        </div>

        {label ? (
          <span className="max-w-[40px] truncate rounded bg-black/65 px-0.5 py-px text-[6px] font-medium leading-tight text-white shadow-sm sm:max-w-[48px] sm:text-[7px]">
            {number != null ? (
              <span className={cn('font-bold', side === 'home' ? 'text-sky-200' : 'text-rose-200')}>
                {number}
              </span>
            ) : null}
            {number != null ? ' ' : null}
            {label}
          </span>
        ) : null}
      </button>

      <div
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 hidden -translate-x-1/2 group-hover/marker:block group-focus-within/marker:block"
      >
        <PitchPlayerHoverCard
          player={player}
          position={position}
          teamCode={teamCode}
          side={side}
        />
      </div>
    </div>
  );
}

function PitchHalf({
  players,
  side,
  teamLabel,
  teamCode,
  onPlayerClick,
  playerEventSummaries,
  highlightKey,
  onPlayerHighlight,
  timelineEvents = [],
}) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-y-0 w-1/2',
        side === 'home' ? 'left-0' : 'right-0'
      )}
      aria-label={teamLabel}
    >
      <div className="relative h-full w-full">
        {players.map((player, index) => (
          <PlayerMarker
            key={player.playerId ?? `${side}-${index}`}
            player={player}
            side={side}
            index={index}
            teamCode={teamCode}
            onPlayerClick={onPlayerClick}
            eventSummary={
              playerEventSummaries
                ? playerEventSummaries.get(playerKeyFromLineupPlayer(player, side))
                : null
            }
            highlightKey={highlightKey}
            onPlayerHighlight={onPlayerHighlight}
            timelineEvents={timelineEvents}
          />
        ))}
      </div>
    </div>
  );
}

function CoachBadge({ coach, side, formation, onCoachClick }) {
  const coachName = typeof coach === 'string' ? coach : coach?.name;
  const photoUrl = typeof coach === 'object' && coach ? coach.photoUrl : null;
  if (!coachName) return null;

  const label = shortName(coachName);
  const ringClass = side === 'home' ? 'ring-sky-400/80' : 'ring-rose-400/80';

  return (
    <div className="group/coach relative z-20 group-hover/coach:z-[60] group-focus-within/coach:z-[60]">
      <button
        type="button"
        className="flex flex-col items-center gap-px rounded-md p-px transition hover:bg-black/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        onClick={(event) => {
          event.stopPropagation();
          onCoachClick?.({
            ...(typeof coach === 'object' && coach ? coach : { name: coachName, photoUrl }),
            formation: formation ?? null,
            teamSide: side,
          });
        }}
        aria-label={`Ver ficha de ${coachName}`}
      >
        <span className="text-[5px] font-semibold leading-none text-white/90 sm:text-[6px]">DT</span>
        <PlayerAvatar
          name={coachName}
          photoUrl={photoUrl}
          size="xs"
          className={cn('h-5 w-5 shadow-sm ring-1 sm:h-6 sm:w-6', ringClass)}
        />
        {label ? (
          <span className="max-w-[40px] truncate rounded bg-black/65 px-0.5 py-px text-[6px] font-medium leading-tight text-white shadow-sm sm:max-w-[48px] sm:text-[7px]">
            {label}
          </span>
        ) : null}
      </button>

      <div
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1 hidden w-max max-w-[11rem] -translate-x-1/2 rounded-md border border-white/20 bg-black/90 px-2 py-1 text-center text-[9px] leading-snug text-white shadow-lg group-hover/coach:block"
      >
        <p className="font-semibold">DT · {coachName}</p>
        <p className="mt-0.5 text-[8px] text-white/60">Clic para ver ficha</p>
      </div>
    </div>
  );
}

function PitchMarkings() {
  return (
    <>
      <div className="pointer-events-none absolute inset-2 rounded border border-white/35" />

      <div className="pointer-events-none absolute bottom-2 left-1/2 top-2 w-px -translate-x-1/2 bg-white/35" />

      <div className="pointer-events-none absolute left-1/2 top-1/2 w-[24%] aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/40" />

      <div className="pointer-events-none absolute bottom-[18%] left-2 top-[18%] w-[18%] border border-white/30" />
      <div className="pointer-events-none absolute bottom-[32%] left-2 top-[32%] w-[7%] border border-white/25" />

      <div className="pointer-events-none absolute bottom-[18%] right-2 top-[18%] w-[18%] border border-white/30" />
      <div className="pointer-events-none absolute bottom-[32%] right-2 top-[32%] w-[7%] border border-white/25" />

      <div className="pointer-events-none absolute bottom-[28%] left-2 top-[28%] w-px bg-white/50" />
      <div className="pointer-events-none absolute bottom-[28%] right-2 top-[28%] w-px bg-white/50" />
    </>
  );
}

export default function PitchFormation({
  lineup,
  homeLabel,
  awayLabel,
  homeTeamCode,
  awayTeamCode,
  className,
  events = [],
  heatmapMode = 'normal',
  highlightKey = null,
  onHighlightKeyChange,
  showEventLayer = false,
  homeScore = 0,
  awayScore = 0,
}) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailPreview, setDetailPreview] = useState(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [selectedExternalId, setSelectedExternalId] = useState(null);
  const [coachDetailOpen, setCoachDetailOpen] = useState(false);
  const [coachDetail, setCoachDetail] = useState(null);

  const homePlayers = lineup?.home?.players ?? [];
  const awayPlayers = lineup?.away?.players ?? [];
  const hasPlayers = homePlayers.length > 0 || awayPlayers.length > 0;

  const {
    showAttackHeatmapLayer,
    showHeatmapLayer,
    showPlayerLayer,
    showEventPins,
    showGoalPinsOnNormal,
    showTeamLabels,
    shouldRenderPitch,
  } = resolvePitchFormationLayers({
    hasPlayers,
    showEventLayer,
    heatmapMode,
    homeScore,
    awayScore,
  });

  const homeEventSummaries = useMemo(
    () => (showPlayerLayer && showEventLayer ? buildPlayerEventSummary(events, 'home') : null),
    [events, showEventLayer, showPlayerLayer]
  );
  const awayEventSummaries = useMemo(
    () => (showPlayerLayer && showEventLayer ? buildPlayerEventSummary(events, 'away') : null),
    [events, showEventLayer, showPlayerLayer]
  );

  if (!shouldRenderPitch) return null;

  const handlePlayerClick = (player) => {
    setDetailPreview({
      name: player.name,
      photoUrl: player.photoUrl,
      shirtNumber: player.shirtNumber,
      position: player.position,
      teamFifaCode: player.teamFifaCode,
      playerId: player.mongoId ?? null,
      externalId: player.externalId ?? null,
    });
    setSelectedPlayerId(player.mongoId ?? null);
    setSelectedExternalId(player.externalId ?? null);
    setDetailOpen(true);
  };

  const handleDetailOpenChange = (open) => {
    setDetailOpen(open);
    if (!open) {
      setDetailPreview(null);
      setSelectedPlayerId(null);
      setSelectedExternalId(null);
    }
  };

  const handleCoachClick = (coach) => {
    setCoachDetail({
      ...coach,
      teamName:
        coach.teamName ?? (coach.teamSide === 'home' ? homeLabel : awayLabel),
      teamFifaCode:
        coach.teamFifaCode ?? (coach.teamSide === 'home' ? homeTeamCode : awayTeamCode),
    });
    setCoachDetailOpen(true);
  };

  const handleCoachDetailOpenChange = (open) => {
    setCoachDetailOpen(open);
    if (!open) setCoachDetail(null);
  };

  return (
    <>
      <div
        className={cn(
          'relative mx-auto aspect-[5/3] w-full max-w-lg overflow-visible rounded-lg',
          className
        )}
      >
        <div className="absolute inset-0 overflow-hidden rounded-lg border border-emerald-700/50 bg-gradient-to-b from-emerald-700 to-emerald-800">
          <PitchMarkings />
          {showAttackHeatmapLayer ? (
            <PitchHeatmapLayer events={events} heatmapMode="normal" />
          ) : null}
          {showHeatmapLayer ? (
            <PitchHeatmapLayer events={events} heatmapMode={heatmapMode} />
          ) : null}
          {showGoalPinsOnNormal ? (
            <PitchEventPinVisuals
              events={events}
              highlightKey={highlightKey}
              heatmapMode="goals"
              homeTeamCode={homeTeamCode}
              awayTeamCode={awayTeamCode}
            />
          ) : null}
          {showEventPins ? (
            <PitchEventPinVisuals
              events={events}
              highlightKey={highlightKey}
              heatmapMode={heatmapMode}
              homeTeamCode={homeTeamCode}
              awayTeamCode={awayTeamCode}
            />
          ) : null}
        </div>

        {showTeamLabels ? (
          <>
            <div className="pointer-events-auto absolute bottom-1 left-2 z-20 flex items-end gap-1">
              <CoachBadge
                coach={lineup?.home?.coach}
                side="home"
                formation={lineup?.home?.formation}
                onCoachClick={handleCoachClick}
              />
              <span className="rounded bg-black/35 px-1.5 py-0.5 text-[9px] font-semibold text-white/90">
                {homeLabel}
              </span>
            </div>
            <div className="pointer-events-auto absolute bottom-1 right-2 z-20 flex items-end gap-1">
              <span className="rounded bg-black/35 px-1.5 py-0.5 text-[9px] font-semibold text-white/90">
                {awayLabel}
              </span>
              <CoachBadge
                coach={lineup?.away?.coach}
                side="away"
                formation={lineup?.away?.formation}
                onCoachClick={handleCoachClick}
              />
            </div>
          </>
        ) : null}

        {showPlayerLayer ? (
          <>
            <PitchHalf
              players={homePlayers}
              side="home"
              teamLabel={homeLabel}
              teamCode={homeTeamCode}
              onPlayerClick={handlePlayerClick}
              playerEventSummaries={homeEventSummaries}
              highlightKey={highlightKey}
              onPlayerHighlight={onHighlightKeyChange}
              timelineEvents={events}
            />
            <PitchHalf
              players={awayPlayers}
              side="away"
              teamLabel={awayLabel}
              teamCode={awayTeamCode}
              onPlayerClick={handlePlayerClick}
              playerEventSummaries={awayEventSummaries}
              highlightKey={highlightKey}
              onPlayerHighlight={onHighlightKeyChange}
              timelineEvents={events}
            />
          </>
        ) : null}

        {showGoalPinsOnNormal ? (
          <PitchEventPinInteractions
            events={events}
            highlightKey={highlightKey}
            heatmapMode="goals"
            homeTeamCode={homeTeamCode}
            awayTeamCode={awayTeamCode}
            onEventSelect={(nextKey) => {
              onHighlightKeyChange?.(highlightKey === nextKey ? null : nextKey);
            }}
          />
        ) : null}

        {showEventPins ? (
          <PitchEventPinInteractions
            events={events}
            highlightKey={highlightKey}
            heatmapMode={heatmapMode}
            homeTeamCode={homeTeamCode}
            awayTeamCode={awayTeamCode}
            onEventSelect={(nextKey) => {
              onHighlightKeyChange?.(highlightKey === nextKey ? null : nextKey);
            }}
          />
        ) : null}
      </div>

      {detailOpen ? (
        <PlayerDetailDialog
          playerId={selectedPlayerId}
          externalId={selectedExternalId}
          preview={detailPreview}
          open={detailOpen}
          onOpenChange={handleDetailOpenChange}
        />
      ) : null}

      <CoachDetailDialog
        coach={coachDetail}
        open={coachDetailOpen}
        onOpenChange={handleCoachDetailOpenChange}
      />
    </>
  );
}
