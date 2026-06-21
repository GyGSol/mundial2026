import PlayerAvatar from '@/components/PlayerAvatar.jsx';
import {
  eventHasPitchCoords,
  fifaEventToPitchPercent,
  HEATMAP_EVENT_TYPES,
} from '@/lib/pitchCoordinates.js';
import { getTeamPitchPinColors } from '@/lib/teamPitchColors.js';
import { playerKeyFromTimelineEvent } from '@/lib/lineupLiveState.js';
import {
  filterTimelineForDisplay,
  formatPitchEventHoverDetail,
  formatTimelineMinute,
  timelineEventIdentity,
} from '@/lib/matchTimelineDisplay.js';
import {
  extractTimelinePlayerFields,
  getTimelineActionIcon,
  getTimelineActionLabel,
} from '@/lib/playerPositionLabel.js';
import { cn } from '@/lib/utils';

const PIN_EVENT_TYPES = new Set([
  'goal',
  'yellow_card',
  'red_card',
  'shot_attempt',
  'foul',
  'substitution',
]);

function eventHighlightKey(event) {
  return playerKeyFromTimelineEvent(event) ?? timelineEventIdentity(event);
}

/** Clave al elegir una fila del timeline (evento con coords → identidad única). */
export function pitchHighlightKeyForTimeline(event) {
  if (eventHasPitchCoords(event)) return timelineEventIdentity(event);
  return playerKeyFromTimelineEvent(event) ?? timelineEventIdentity(event);
}

export function pinMatchesHighlight(event, highlightKey) {
  if (!highlightKey) return false;
  if (timelineEventIdentity(event) === highlightKey) return true;
  return eventHighlightKey(event) === highlightKey;
}

function pinMatchesHeatmapMode(event, heatmapMode) {
  if (!heatmapMode || heatmapMode === 'normal') return false;
  const types = HEATMAP_EVENT_TYPES[heatmapMode];
  return types?.has(event?.type) ?? false;
}

function pinDotClassName(event, highlighted, homeTeamCode, awayTeamCode) {
  const side = event.side === 'away' ? 'away' : 'home';
  const teamCode = side === 'home' ? homeTeamCode : awayTeamCode;
  const jersey = getTeamPitchPinColors(teamCode, side);

  return cn(
    'block h-2 w-2 rounded-full ring-2 transition',
    jersey.dot,
    jersey.ring,
    event.type === 'goal' && 'h-2.5 w-2.5',
    highlighted && 'scale-150 ring-white'
  );
}

function buildPitchPins(events = [], { heatmapMode = 'normal', homeTeamCode, awayTeamCode } = {}) {
  const isHeatmapView =
    heatmapMode === 'shots' || heatmapMode === 'fouls' || heatmapMode === 'goals';

  return filterTimelineForDisplay(events)
    .filter((event) => {
      if (!PIN_EVENT_TYPES.has(event.type) || !eventHasPitchCoords(event)) return false;
      if (isHeatmapView) return pinMatchesHeatmapMode(event, heatmapMode);
      return false;
    })
    .map((event) => ({
      event,
      key: timelineEventIdentity(event),
      highlight: eventHighlightKey(event),
      style: fifaEventToPitchPercent(event),
      ariaLabel: formatPitchEventHoverDetail(event, {
        getActionLabel: getTimelineActionLabel,
        extractPlayer: extractTimelinePlayerFields,
      }),
    }))
    .filter((pin) => pin.style);
}

function pitchEventPlayers(event) {
  if (event.type === 'substitution') {
    const rows = [];
    const playerOut = extractTimelinePlayerFields(event, 'out');
    const playerIn = extractTimelinePlayerFields(event, 'in');
    if (playerOut) rows.push({ ...playerOut, role: 'out' });
    if (playerIn) rows.push({ ...playerIn, role: 'in' });
    return rows;
  }

  const player = extractTimelinePlayerFields(event, 'player');
  return player ? [{ ...player, role: 'player' }] : [];
}

function PitchEventPlayerRow({ player, side }) {
  const ringClass = side === 'home' ? 'ring-sky-400/80' : 'ring-rose-400/80';

  return (
    <div className="match-live-action-player flex min-w-0 items-center gap-1.5">
      <PlayerAvatar
        name={player.name}
        photoUrl={player.photoUrl}
        size="xs"
        variant="portrait"
        className={cn(
          'max-h-7 max-w-[1.375rem] shrink-0 shadow-sm ring-1 sm:max-h-9 sm:max-w-[1.75rem]',
          ringClass
        )}
      />
      <div className="grid min-w-0 flex-1 grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-x-1 text-[9px] leading-tight">
        <span className="tabular-nums font-medium text-foreground">
          {player.shirtNumber != null ? player.shirtNumber : '—'}
        </span>
        <span className="text-muted-foreground">{player.position ?? '—'}</span>
        <span className="min-w-0 truncate font-medium text-foreground">{player.name}</span>
      </div>
    </div>
  );
}

function PitchEventHoverCard({ event }) {
  const actionLabel = getTimelineActionLabel(event.type) ?? 'Evento';
  const minute = formatTimelineMinute(event);
  const icon = getTimelineActionIcon(event.type);
  const players = pitchEventPlayers(event);

  return (
    <div className="match-live-action-card w-max min-w-[9.5rem] max-w-[13rem] rounded-md border border-border bg-card px-2 py-1.5 text-left shadow-md">
      <div className="match-live-action-header flex items-center justify-between gap-2">
        <span className="shrink-0 tabular-nums text-[10px] font-semibold text-foreground">
          {minute || '—'}
        </span>
        <span className="inline-flex min-w-0 items-center justify-end gap-1 text-right text-[10px] font-medium text-foreground">
          {icon ? <span aria-hidden="true">{icon}</span> : null}
          <span className="truncate">{actionLabel}</span>
        </span>
      </div>
      {players.length ? (
        <div className="match-live-action-body mt-1 flex flex-col gap-1">
          {players.map((player) => (
            <div
              key={`${player.role}-${player.name}`}
              className={cn(
                player.role === 'out' && 'text-red-700',
                player.role === 'in' && 'text-emerald-700'
              )}
            >
              <PitchEventPlayerRow player={player} side={event.side} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Puntos visuales debajo de los jugadores (sin interacción). */
export function PitchEventPinVisuals({
  events = [],
  highlightKey = null,
  heatmapMode = 'normal',
  homeTeamCode,
  awayTeamCode,
  className,
}) {
  const pins = buildPitchPins(events, { heatmapMode, homeTeamCode, awayTeamCode });
  if (!pins.length) return null;

  return (
    <div className={cn('pointer-events-none absolute inset-0 z-[2]', className)} aria-hidden>
      {pins.map(({ event, key, highlight, style }) => (
        <span
          key={key}
          className={cn(
            'absolute -translate-x-1/2 -translate-y-1/2',
            pinDotClassName(
              event,
              pinMatchesHighlight(event, highlightKey),
              homeTeamCode,
              awayTeamCode
            )
          )}
          style={style}
        />
      ))}
    </div>
  );
}

/** Área de hover/clic y popup encima de los jugadores. */
export function PitchEventPinInteractions({
  events = [],
  highlightKey = null,
  heatmapMode = 'normal',
  homeTeamCode,
  awayTeamCode,
  onEventSelect,
  className,
}) {
  const pins = buildPitchPins(events, { heatmapMode, homeTeamCode, awayTeamCode });
  if (!pins.length) return null;

  return (
    <div className={cn('pointer-events-none absolute inset-0 z-40', className)}>
      {pins.map(({ event, key, highlight, style, ariaLabel }) => (
        <div
          key={key}
          className="group/pin pointer-events-auto absolute z-40 -translate-x-1/2 -translate-y-1/2 group-hover/pin:z-[60] group-focus-within/pin:z-[60]"
          style={style}
        >
          <button
            type="button"
            className={cn(
              'h-6 w-6 rounded-full bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70',
              pinMatchesHighlight(event, highlightKey) && 'ring-2 ring-white/90 ring-offset-1 ring-offset-emerald-900'
            )}
            aria-label={ariaLabel}
            aria-pressed={pinMatchesHighlight(event, highlightKey)}
            onClick={(clickEvent) => {
              clickEvent.stopPropagation();
              const nextKey = pitchHighlightKeyForTimeline(event);
              onEventSelect?.(nextKey, event);
            }}
          />
          <div
            role="tooltip"
            className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 hidden -translate-x-1/2 group-hover/pin:block group-focus-within/pin:block"
          >
            <PitchEventHoverCard event={event} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PitchEventLayer(props) {
  return (
    <>
      <PitchEventPinVisuals {...props} />
      <PitchEventPinInteractions {...props} />
    </>
  );
}

export function countEventsWithoutCoords(events = []) {
  return filterTimelineForDisplay(events).filter(
    (event) => PIN_EVENT_TYPES.has(event.type) && !eventHasPitchCoords(event)
  ).length;
}
