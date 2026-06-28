import { ArrowDown, ArrowUp, ChevronDown } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DialogTitleWithIcon from '@/components/DialogTitleWithIcon.jsx';
import { BrokenLegIcon } from '@/components/icons/BrokenLegIcon.jsx';
import { PopupFubolIcon } from '@/components/icons/popup/index.js';
import { getTeamFlag, matchInvolvesArgentina } from '@/lib/teamMeta';
import {
  filterTimelineForDisplay,
  formatNeutralTimelineLabel,
  timelineEventIdentity,
  timelineEventsSignature,
} from '@/lib/matchTimelineDisplay.js';
import { Badge } from '@/components/ui/badge.jsx';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card.jsx';
import { cn } from '@/lib/utils';
import { ARGENTINA_TIMEZONE, formatMatchDate } from '@/lib/dateFormat';
import {
  buildMatchSummaryRows,
  formatMatchAttendance,
  getMatchSummaryNotice,
} from '@/lib/matchSummary';
import {
  extractTimelinePlayerFields,
  formatSummaryPlayer,
  getTimelineActionIcon,
  getTimelineActionLabel,
} from '@/lib/playerPositionLabel.js';
import KickoffCountdown from '@/components/KickoffCountdown.jsx';
import PlayerAvatar from '@/components/PlayerAvatar.jsx';
import PlayerDetailDialog from '@/components/PlayerDetailDialog.jsx';
import { Button } from '@/components/ui/button.jsx';

import BroadcastBadges from '@/components/BroadcastBadges.jsx';
import MatchLineupSection, {
  shouldShowMatchLineup,
  shouldUseInteractivePitch,
} from '@/components/lineup/MatchLineupSection.jsx';
import { pitchHighlightKeyForTimeline } from '@/components/lineup/PitchEventLayer.jsx';
import { playerKeyFromTimelineEvent } from '@/lib/lineupLiveState.js';
import LiveMatchTrigger from '@/components/live/LiveMatchTrigger.jsx';
import { liveCardBadgeLabel, isLiveCardFinalizing } from '@/lib/matchStatus.js';
import { useLiveMatchDisplayClock } from '@/hooks/useLiveMatchDisplayClock.js';
import { getEffectiveMatchPlayState, isMatchPlayPaused, resolveLiveMatchesColumnTitle } from '@/lib/matchPlayState.js';
import WeatherOpsBadge, { getWeatherOpsLabel, LiveScheduleAlert } from '@/components/WeatherOpsBadge.jsx';
import VenueCurrentWeatherCorner from '@/components/VenueCurrentWeatherCorner.jsx';
import MatchPlayStateBadge, { getMatchPlayStateLabel } from '@/components/MatchPlayStateBadge.jsx';
import { matchBarGridClass } from '@/lib/matchBarLayout.js';
import { sortLiveMatchesForFeaturedBar } from '@/lib/liveMatchFeaturedSort.js';
import PenaltyShootoutDisplay, { PenaltyShootoutScoreLine } from '@/components/PenaltyShootoutDisplay.jsx';

const matchDateLabel = (match) =>
  formatMatchDate(match, { showTimezone: true, timeZone: ARGENTINA_TIMEZONE });

function normalizeScorerEntry(entry) {
  if (typeof entry === 'string') {
    const trimmed = entry.trim();
    if (!trimmed) return null;

    const minuteSuffix = trimmed.match(/^(.+?)\s+(\d+)\s*['']?\s*$/);
    if (minuteSuffix) {
      return { name: minuteSuffix[1].trim(), minute: Number(minuteSuffix[2]) };
    }

    const minutePrefix = trimmed.match(/^(\d+)\s*['']?\s+(.+)$/);
    if (minutePrefix) {
      return { name: minutePrefix[2].trim(), minute: Number(minutePrefix[1]) };
    }

    return { name: trimmed, minute: null };
  }

  if (entry && typeof entry === 'object' && entry.name) {
    return {
      name: String(entry.name).trim(),
      minute: entry.minute != null ? Number(entry.minute) : null,
      position: entry.position ?? null,
      shirtNumber: entry.shirtNumber ?? null,
      positionX: entry.positionX ?? null,
      positionY: entry.positionY ?? null,
    };
  }

  return null;
}

function normalizeScorerList(scorers) {
  if (!scorers) return [];
  const list = Array.isArray(scorers) ? scorers : [scorers];
  return list.map(normalizeScorerEntry).filter(Boolean);
}

function formatScorerLine(scorer) {
  if (!scorer?.name) return null;
  const label = formatSummaryPlayer(scorer);
  const penaltySuffix = scorer.isPenalty ? ' (p)' : '';
  const base = scorer.minute != null ? `${scorer.minute}' ${label}` : label;
  return `${base}${penaltySuffix}`;
}

function MatchScoreCenter({ match, scoreClassName = 'text-xl' }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className={cn('match-live-score flex items-center gap-1 font-bold tabular-nums', scoreClassName)}>
        <span>{match.homeScore}</span>
        <span className="text-muted-foreground">-</span>
        <span>{match.awayScore}</span>
      </div>
      <PenaltyShootoutScoreLine penaltyShootout={match.penaltyShootout} />
    </div>
  );
}

function cardSymbol(card) {
  const normalized = String(card ?? 'YELLOW').toUpperCase();
  if (normalized === 'RED') return '🟥';
  if (normalized === 'YELLOW_RED') return '🟨🟥';
  return '🟨';
}

function formatBookingLine(booking) {
  if (!booking?.player) return null;
  const minute = booking.minute != null ? `${booking.minute}' ` : '';
  const label = formatSummaryPlayer({
    name: booking.player,
    position: booking.position,
    shirtNumber: booking.shirtNumber,
    positionX: booking.positionX,
    positionY: booking.positionY,
  });
  return `${minute}${cardSymbol(booking.card)} ${label}`;
}

const SUBSTITUTION_OUT_ICON = '⬇️';
const SUBSTITUTION_IN_ICON = '⬆️';

function TimelinePlayerRow({ player, align = 'left', teamSide, onPhotoClick }) {
  if (!player) return null;
  const { shirtNumber, position, name, tournamentGoals, photoUrl } = player;
  const textAlign =
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

  const handlePhotoClick = () => {
    if (!photoUrl || !onPhotoClick) return;
    onPhotoClick({ ...player, teamSide });
  };

  return (
    <div className="match-live-action-player flex w-full min-w-0 items-center gap-2">
      <div
        className={cn(
          'grid min-w-0 flex-1 grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-x-1.5',
          textAlign
        )}
      >
        <span className="tabular-nums font-medium text-foreground">
          {shirtNumber != null ? shirtNumber : '—'}
        </span>
        <span className="text-muted-foreground">{position ?? '—'}</span>
        <span className="min-w-0 truncate font-medium text-foreground">{name}</span>
        {tournamentGoals != null ? (
          <span
            className="inline-flex items-center gap-0.5 tabular-nums text-emerald-700"
            title="Goles en el torneo"
          >
            <span aria-hidden="true">⚽</span>
            <span>{tournamentGoals}</span>
          </span>
        ) : (
          <span aria-hidden="true" />
        )}
      </div>
      {photoUrl ? (
        <button
          type="button"
          className={cn(
            'match-live-action-player-thumb shrink-0 rounded-md transition',
            'hover:ring-2 hover:ring-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          )}
          onClick={handlePhotoClick}
          aria-label={`Ver ficha de ${name}`}
          title="Ver ficha del jugador"
        >
          <PlayerAvatar
            name={name}
            photoUrl={photoUrl}
            size="xs"
            variant="portrait"
            className="pointer-events-none max-h-7 max-w-[1.375rem] sm:max-h-10 sm:max-w-[2.25rem]"
          />
        </button>
      ) : null}
    </div>
  );
}

function TimelineActionCard({
  entry,
  align = 'center',
  onPlayerPhotoClick,
  highlightKey = null,
  onHighlightSelect,
}) {
  const hasPlayers = (entry.players?.length ?? 0) > 0;
  const bodyAlign = align === 'home' ? 'left' : align === 'away' ? 'right' : 'center';
  const isHighlighted =
    highlightKey &&
    entry.highlightKey &&
    (highlightKey === entry.highlightKey ||
      (entry.playerHighlightKey && highlightKey === entry.playerHighlightKey));

  return (
    <div
      role={onHighlightSelect && entry.highlightKey ? 'button' : undefined}
      tabIndex={onHighlightSelect && entry.highlightKey ? 0 : undefined}
      className={cn(
        'match-live-action-card w-full max-w-full rounded-md text-left transition',
        onHighlightSelect && entry.highlightKey && 'cursor-pointer hover:bg-muted/40',
        isHighlighted && 'bg-emerald-100/80 ring-1 ring-emerald-400'
      )}
      data-highlight-key={entry.highlightKey ?? undefined}
      data-player-key={entry.playerHighlightKey ?? undefined}
      onClick={() => {
        if (!entry.highlightKey || !onHighlightSelect) return;
        onHighlightSelect(isHighlighted ? null : entry.highlightKey);
      }}
      onKeyDown={(event) => {
        if (!entry.highlightKey || !onHighlightSelect) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onHighlightSelect(isHighlighted ? null : entry.highlightKey);
        }
      }}
    >
      <div className="match-live-action-header flex items-center justify-between gap-2">
        <span className="shrink-0 tabular-nums font-semibold text-foreground">{entry.minute || '—'}</span>
        <span className="inline-flex min-w-0 items-center justify-end gap-1 text-right font-medium text-foreground">
          {entry.iconNode ?? (entry.icon ? <span aria-hidden="true">{entry.icon}</span> : null)}
          <span className="truncate">{entry.actionLabel}</span>
          {entry.actionSuffix ? (
            <span className="shrink-0 text-muted-foreground">{entry.actionSuffix}</span>
          ) : null}
        </span>
      </div>
      {hasPlayers ? (
        <div className="match-live-action-body flex flex-col gap-1">
          {entry.players.map((player) => (
            <div
              key={`${player.role}-${player.name}`}
              className={cn(
                'flex items-center gap-1',
                player.role === 'out' && 'text-red-700',
                player.role === 'in' && 'text-emerald-700'
              )}
            >
              {player.role === 'out' ? (
                <ArrowDown className="match-live-icon size-3 shrink-0" strokeWidth={2.75} aria-hidden="true" />
              ) : null}
              {player.role === 'in' ? (
                <ArrowUp className="match-live-icon size-3 shrink-0" strokeWidth={2.75} aria-hidden="true" />
              ) : null}
              {entry.kind === 'foul' && player.role === 'player' ? (
                <BrokenLegIcon />
              ) : null}
              <TimelinePlayerRow
                player={player}
                align={bodyAlign}
                teamSide={entry.side}
                onPhotoClick={onPlayerPhotoClick}
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function formatSubstitutionLine(substitution) {
  if (!substitution?.playerOut || !substitution?.playerIn) return null;
  const minute = substitution.minute != null ? `${substitution.minute}' ` : '';
  const playerOut = formatSummaryPlayer({
    name: substitution.playerOut,
    position: substitution.playerOutPosition,
    shirtNumber: substitution.playerOutShirtNumber,
    positionX: substitution.playerOutPositionX,
    positionY: substitution.playerOutPositionY,
  });
  const playerIn = formatSummaryPlayer({
    name: substitution.playerIn,
    position: substitution.playerInPosition,
    shirtNumber: substitution.playerInShirtNumber,
    positionX: substitution.playerInPositionX,
    positionY: substitution.playerInPositionY,
  });
  return `${minute}${SUBSTITUTION_OUT_ICON} ${playerOut}  ${SUBSTITUTION_IN_ICON} ${playerIn}`;
}

function countYellowCards(bookings = []) {
  return (bookings ?? []).filter((booking) => {
    const card = String(booking?.card ?? 'YELLOW').toUpperCase();
    return card === 'YELLOW' || card === 'YELLOW_RED';
  }).length;
}

function countRedCards(bookings = []) {
  return (bookings ?? []).filter((booking) => {
    const card = String(booking?.card ?? 'YELLOW').toUpperCase();
    return card === 'RED' || card === 'YELLOW_RED';
  }).length;
}

function TeamSideStats({ bookings = [], substitutions = [], className }) {
  const yellowCount = countYellowCards(bookings);
  const redCount = countRedCards(bookings);
  const substitutionCount = (substitutions ?? []).length;

  if (yellowCount === 0 && redCount === 0 && substitutionCount === 0) return null;

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 match-live-text-meta text-[11px] leading-tight tabular-nums text-muted-foreground',
        className
      )}
    >
      {yellowCount > 0 ? (
        <span className="inline-flex items-center gap-0.5" title="Tarjetas amarillas">
          <span aria-hidden="true">🟨</span>
          <span>{yellowCount}</span>
        </span>
      ) : null}
      {redCount > 0 ? (
        <span className="inline-flex items-center gap-0.5" title="Tarjetas rojas">
          <span aria-hidden="true">🟥</span>
          <span>{redCount}</span>
        </span>
      ) : null}
      {substitutionCount > 0 ? (
        <span className="inline-flex items-center gap-1" title="Cambios">
          <span className="inline-flex items-center gap-px" aria-hidden="true">
            <ArrowDown className="match-live-icon-lg size-3.5 shrink-0 text-red-500" strokeWidth={2.75} />
            <ArrowUp className="match-live-icon-lg size-3.5 shrink-0 text-emerald-500" strokeWidth={2.75} />
          </span>
          <span className="font-semibold text-foreground">{substitutionCount}</span>
        </span>
      ) : null}
    </div>
  );
}

function TeamHeaderCell({ name, flag, bookings = [], substitutions = [], side = 'home' }) {
  const showStats =
    countYellowCards(bookings) > 0 ||
    countRedCards(bookings) > 0 ||
    (substitutions ?? []).length > 0;

  return (
    <div className="flex flex-col items-center gap-1 text-center">
      {showStats ? (
        <TeamSideStats bookings={bookings} substitutions={substitutions} className="items-center" />
      ) : null}
      {flag ? (
        <img src={flag} alt={name} className="match-live-flag size-8 shrink-0 rounded-sm border object-cover" />
      ) : null}
      <span className="match-live-team-name max-w-[5.5rem] truncate text-xs font-medium">{name}</span>
    </div>
  );
}

function TeamEventColumn({ lines, className }) {
  if (!lines.length) return null;

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-0.5 text-center match-live-text text-[10px] leading-snug text-muted-foreground',
        className
      )}
    >
      {lines.map((line, index) => (
        <span key={index}>{line}</span>
      ))}
    </div>
  );
}

/** Misma grilla que banderas + marcador para alinear la cronología debajo de cada país. */
const MATCH_SIDE_GRID_CLASS =
  'match-live-grid grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-x-3';

const MATCH_SIDE_CELL_CLASS = 'flex flex-col items-center px-1 text-center';
const MATCH_CENTER_CELL_CLASS =
  'flex min-w-[3.25rem] items-start justify-center self-stretch px-1 text-center';

function MatchTeamsLayout({
  homeName,
  awayName,
  homeFlag,
  awayFlag,
  center,
  homeScorers = [],
  awayScorers = [],
  homeBookings = [],
  awayBookings = [],
  homeSubstitutions = [],
  awaySubstitutions = [],
}) {
  const homeScorerLines = normalizeScorerList(homeScorers).map(formatScorerLine).filter(Boolean);
  const awayScorerLines = normalizeScorerList(awayScorers).map(formatScorerLine).filter(Boolean);
  const homeBookingLines = (homeBookings ?? []).map(formatBookingLine).filter(Boolean);
  const awayBookingLines = (awayBookings ?? []).map(formatBookingLine).filter(Boolean);
  const homeSubstitutionLines = (homeSubstitutions ?? [])
    .map(formatSubstitutionLine)
    .filter(Boolean);
  const awaySubstitutionLines = (awaySubstitutions ?? [])
    .map(formatSubstitutionLine)
    .filter(Boolean);

  const showScorers = homeScorerLines.length > 0 || awayScorerLines.length > 0;
  const showBookings = homeBookingLines.length > 0 || awayBookingLines.length > 0;
  const showSubstitutions = homeSubstitutionLines.length > 0 || awaySubstitutionLines.length > 0;

  return (
    <div className={MATCH_SIDE_GRID_CLASS}>
      <TeamHeaderCell
        name={homeName}
        flag={homeFlag}
        bookings={homeBookings}
        substitutions={homeSubstitutions}
        side="home"
      />

      <div className="match-live-score-cell flex min-h-10 items-center justify-center self-center px-1">{center}</div>

      <TeamHeaderCell
        name={awayName}
        flag={awayFlag}
        bookings={awayBookings}
        substitutions={awaySubstitutions}
        side="away"
      />

      {showScorers ? (
        <>
          <TeamEventColumn lines={homeScorerLines} />
          <div aria-hidden="true" />
          <TeamEventColumn lines={awayScorerLines} />
        </>
      ) : null}

      {showBookings ? (
        <>
          <TeamEventColumn lines={homeBookingLines} className="text-amber-800/90" />
          <div aria-hidden="true" />
          <TeamEventColumn lines={awayBookingLines} className="text-amber-800/90" />
        </>
      ) : null}

      {showSubstitutions ? (
        <>
          <TeamEventColumn lines={homeSubstitutionLines} className="text-sky-800/90" />
          <div aria-hidden="true" />
          <TeamEventColumn lines={awaySubstitutionLines} className="text-sky-800/90" />
        </>
      ) : null}
    </div>
  );
}

const liveCardClassName = (isArgentina) =>
  cn(
    'w-full',
    isArgentina && 'border-sky-300/80 bg-sky-50/95 ring-1 ring-sky-200/90'
  );

function formatTimelineMinute(event) {
  if (event?.extraMinute != null && event?.minute != null) {
    return `${event.minute}+${event.extraMinute}'`;
  }
  if (event?.minute != null) return `${event.minute}'`;
  return '';
}

function neutralTimelineIcon(type) {
  switch (type) {
    case 'goal_disallowed':
      return '🚫';
    case 'yellow_card_reassigned':
      return '🟨';
    case 'var_decision':
      return '📺';
    case 'hydration_break':
      return '💧';
    case 'period_end':
      return '⏸️';
    case 'period_start':
      return '▶️';
    case 'match_end':
      return '🏁';
    default:
      return '•';
  }
}

function formatTimelineEntry(event) {
  const minute = formatTimelineMinute(event);
  const neutralLabel = formatNeutralTimelineLabel(event);

  if (neutralLabel) {
    return {
      side: 'neutral',
      minute,
      actionLabel: neutralLabel,
      icon: neutralTimelineIcon(event.type),
      players: [],
    };
  }

  const actionLabel = getTimelineActionLabel(event.type);
  if (!actionLabel) return null;

  const base = {
    side: event.side,
    minute,
    actionLabel,
    icon: getTimelineActionIcon(event.type),
    actionSuffix: null,
    kind: event.type,
    players: [],
  };

  switch (event.type) {
    case 'goal': {
      const player = extractTimelinePlayerFields(event, 'player');
      return {
        ...base,
        icon: event.includesShot ? '🎯⚽' : '⚽',
        actionSuffix: event.isPenalty ? '(p)' : null,
        players: player ? [{ ...player, role: 'player' }] : [],
      };
    }
    case 'yellow_card':
    case 'red_card': {
      const player = extractTimelinePlayerFields(event, 'player');
      return {
        ...base,
        players: player ? [{ ...player, role: 'player' }] : [],
      };
    }
    case 'substitution': {
      const playerOut = extractTimelinePlayerFields(event, 'out');
      const playerIn = extractTimelinePlayerFields(event, 'in');
      const players = [];
      if (playerOut) players.push({ ...playerOut, role: 'out' });
      if (playerIn) players.push({ ...playerIn, role: 'in' });
      return { ...base, players };
    }
    case 'foul': {
      const player = extractTimelinePlayerFields(event, 'player');
      return {
        ...base,
        icon: null,
        kind: 'foul',
        players: player ? [{ ...player, role: 'player' }] : [],
      };
    }
    case 'shot_attempt': {
      const player = extractTimelinePlayerFields(event, 'player');
      return {
        ...base,
        players: player ? [{ ...player, role: 'player' }] : [],
      };
    }
    default:
      return null;
  }
}

function timelineSortKey(event) {
  if (event?.sortKey != null) {
    const key = Number(event.sortKey);
    if (Number.isFinite(key)) return key;
  }
  if (event?.minute == null || !Number.isFinite(Number(event.minute))) {
    return Number.NEGATIVE_INFINITY;
  }
  const minute = Number(event.minute);
  const extra = Number(event.extraMinute ?? 0);
  return minute + extra / 100;
}

/** Desempate en el límite del entretiempo (Fin 1.er vs Inicio 2.º). */
function compareTimelineEntries(a, b) {
  const keyDiff = timelineSortKey(b) - timelineSortKey(a);
  if (keyDiff !== 0) return keyDiff;
  const halftimeOrder = { period_start: 1, period_end: 0 };
  return (halftimeOrder[b.type] ?? 0) - (halftimeOrder[a.type] ?? 0);
}

/** Agrupa entradas por instante de juego para alinear las 3 columnas en la misma fila. */
function groupTimelineEntriesByTimeSlot(entries = []) {
  const bySlot = new Map();

  for (const entry of entries) {
    const slotKey = Number.isFinite(entry.sortKey) ? entry.sortKey : entry.minute ?? entry.key;
    if (!bySlot.has(slotKey)) {
      bySlot.set(slotKey, { sortKey: entry.sortKey, home: [], neutral: [], away: [] });
    }
    const row = bySlot.get(slotKey);
    if (entry.side === 'home') row.home.push(entry);
    else if (entry.side === 'neutral') row.neutral.push(entry);
    else if (entry.side === 'away') row.away.push(entry);
  }

  return [...bySlot.values()].sort((a, b) => {
    const keyDiff = (b.sortKey ?? Number.NEGATIVE_INFINITY) - (a.sortKey ?? Number.NEGATIVE_INFINITY);
    if (keyDiff !== 0) return keyDiff;
    return 0;
  });
}

function TimelineRowCell({ entries, align, onPlayerPhotoClick, highlightKey, onHighlightSelect }) {
  if (!entries.length) {
    return <div className="match-live-timeline-slot min-h-0" aria-hidden="true" />;
  }

  const cellAlign =
    align === 'home' ? 'items-start' : align === 'away' ? 'items-end' : 'items-center';

  return (
    <div className={cn('match-live-timeline-slot flex flex-col gap-1.5', cellAlign)}>
      {entries.map((entry) => (
        <div
          key={entry.key}
          className={cn(
            'match-live-entry w-full max-w-[9rem] sm:max-w-[11rem]',
            align === 'away' && 'ml-auto',
            align === 'center' && 'mx-auto'
          )}
        >
          <TimelineActionCard
            entry={entry}
            align={align}
            onPlayerPhotoClick={onPlayerPhotoClick}
            highlightKey={highlightKey}
            onHighlightSelect={onHighlightSelect}
          />
        </div>
      ))}
    </div>
  );
}

function MatchTimeline({
  events = [],
  homeTeamCode,
  awayTeamCode,
  highlightKey = null,
  onHighlightKeyChange,
}) {
  const scrollRef = useRef(null);
  const signature = useMemo(() => timelineEventsSignature(events), [events]);
  const lastSignatureRef = useRef(signature);
  const [displayEvents, setDisplayEvents] = useState(events);
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [selectedExternalId, setSelectedExternalId] = useState(null);
  const [detailPreview, setDetailPreview] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const handlePlayerPhotoClick = (player) => {
    const teamCode =
      player.teamSide === 'home'
        ? homeTeamCode
        : player.teamSide === 'away'
          ? awayTeamCode
          : null;

    setDetailPreview({
      name: player.name,
      photoUrl: player.photoUrl,
      shirtNumber: player.shirtNumber,
      position: player.position,
      tournamentGoals: player.tournamentGoals,
      teamFifaCode: teamCode,
      playerId: player.playerId ?? null,
      externalId: player.externalId ?? null,
    });
    setSelectedPlayerId(player.playerId ?? null);
    setSelectedExternalId(player.externalId ?? null);
    setDetailOpen(true);
  };

  const handleDetailOpenChange = (open) => {
    setDetailOpen(open);
    if (!open) {
      setSelectedPlayerId(null);
      setSelectedExternalId(null);
      setDetailPreview(null);
    }
  };

  useEffect(() => {
    if (signature === lastSignatureRef.current) return;
    lastSignatureRef.current = signature;
    setDisplayEvents(events);
  }, [events, signature]);

  const displayEntries = useMemo(
    () =>
      filterTimelineForDisplay(displayEvents)
        .slice()
        .sort(compareTimelineEntries)
        .map((event) => {
          const entry = formatTimelineEntry(event);
          if (!entry) return null;
          return {
            ...entry,
            key: timelineEventIdentity(event),
            sortKey: timelineSortKey(event),
            highlightKey: pitchHighlightKeyForTimeline(event),
            playerHighlightKey: playerKeyFromTimelineEvent(event),
          };
        })
        .filter(Boolean),
    [displayEvents]
  );

  useEffect(() => {
    if (!highlightKey || !scrollRef.current) return;
    const node =
      scrollRef.current.querySelector(`[data-highlight-key="${CSS.escape(highlightKey)}"]`) ??
      scrollRef.current.querySelector(`[data-player-key="${CSS.escape(highlightKey)}"]`);
    node?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [highlightKey, displayEntries]);

  const timelineRows = useMemo(
    () => groupTimelineEntriesByTimeSlot(displayEntries),
    [displayEntries]
  );

  if (!displayEntries.length) return null;

  return (
    <>
    <div
      ref={scrollRef}
      className="match-live-timeline max-h-60 w-full overflow-y-auto rounded-md border bg-muted/30 py-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="flex flex-col gap-2 match-live-text text-[10px] leading-snug text-muted-foreground">
        {timelineRows.map((row) => (
          <div
            key={String(row.sortKey ?? row.home[0]?.key ?? row.neutral[0]?.key ?? row.away[0]?.key)}
            className={cn(MATCH_SIDE_GRID_CLASS, 'match-live-timeline-row items-stretch')}
          >
            <div className="min-w-0 px-1">
              <TimelineRowCell
                entries={row.home}
                align="home"
                onPlayerPhotoClick={handlePlayerPhotoClick}
                highlightKey={highlightKey}
                onHighlightSelect={onHighlightKeyChange}
              />
            </div>
            <div className="min-w-[3.25rem] px-1">
              <TimelineRowCell
                entries={row.neutral}
                align="center"
                onPlayerPhotoClick={handlePlayerPhotoClick}
                highlightKey={highlightKey}
                onHighlightSelect={onHighlightKeyChange}
              />
            </div>
            <div className="min-w-0 px-1">
              <TimelineRowCell
                entries={row.away}
                align="away"
                onPlayerPhotoClick={handlePlayerPhotoClick}
                highlightKey={highlightKey}
                onHighlightSelect={onHighlightKeyChange}
              />
            </div>
          </div>
        ))}
      </div>
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
    </>
  );
}

function MatchSummary({
  events = [],
  reportStats = null,
  homeCode = 'LOC',
  awayCode = 'VIS',
  status = 'finished',
}) {
  const rows = buildMatchSummaryRows({ timeline: events, reportStats });
  const attendance = formatMatchAttendance(reportStats);
  const notice = getMatchSummaryNotice(status, Boolean(reportStats));
  if (!rows.length) return null;

  return (
    <div className="w-full rounded-md border bg-muted/20 px-3 py-2 text-left match-live-text">
      <p className="mb-2 text-center match-live-text-meta text-[11px] font-medium text-foreground">Resumen del partido</p>
      {notice ? (
        <p className="mb-2 text-center match-live-text-meta text-[10px] text-muted-foreground">{notice}</p>
      ) : null}
      {attendance ? (
        <p className="mb-2 text-center match-live-text-meta text-[10px] text-muted-foreground">
          Asistencia: {attendance}
        </p>
      ) : null}
      <div className="mb-1.5 grid grid-cols-[1fr_auto_1fr] items-center gap-2 match-live-text-meta text-[10px] font-medium text-muted-foreground">
        <span className="text-right">{homeCode}</span>
        <span className="text-center" aria-hidden="true" />
        <span className="text-left">{awayCode}</span>
      </div>
      <div className="flex flex-col gap-1">
        {rows.map((row) => (
          <div
            key={row.label}
            className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 match-live-text text-[10px] leading-snug"
          >
            <span className="text-right font-medium tabular-nums text-foreground">{row.home}</span>
            <span className="min-w-[4.5rem] text-center text-muted-foreground">{row.label}</span>
            <span className="text-left font-medium tabular-nums text-foreground">{row.away}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FinishedTeamsHeader({
  homeName,
  awayName,
  homeFlag,
  awayFlag,
  center,
  homeBookings = [],
  awayBookings = [],
  homeSubstitutions = [],
  awaySubstitutions = [],
}) {
  return (
    <div className={cn(MATCH_SIDE_GRID_CLASS, 'items-center gap-y-1')}>
      <TeamHeaderCell
        name={homeName}
        flag={homeFlag}
        bookings={homeBookings}
        substitutions={homeSubstitutions}
        side="home"
      />
      <div className="match-live-score-cell flex min-h-10 items-center justify-center px-1">{center}</div>
      <TeamHeaderCell
        name={awayName}
        flag={awayFlag}
        bookings={awayBookings}
        substitutions={awaySubstitutions}
        side="away"
      />
    </div>
  );
}

function LiveStatusBadge({ match, isLive, weatherLabel, playStateLabel }) {
  const displayClock = useLiveMatchDisplayClock(isLive ? match : null);
  const finalizingLive = isLive && isLiveCardFinalizing(match);
  const playState = getEffectiveMatchPlayState(match);
  const paused = isLive && isMatchPlayPaused(playState);
  const showLiveBadge = isLive && !weatherLabel && !playStateLabel && !finalizingLive && !paused;

  if (paused) {
    if (playStateLabel) return null;

    const clockSuffix =
      playState.frozenClock &&
      playState.phase !== 'halftime' &&
      playState.frozenClock !== playStateLabel?.text
        ? ` · ${playState.frozenClock}`
        : '';
    return (
      <Badge variant="outline" className="border-amber-300/70 bg-amber-50 text-amber-900">
        {playStateLabel?.text ?? playState.label ?? 'En pausa'}
        {clockSuffix}
      </Badge>
    );
  }

  if (showLiveBadge) {
    const label = liveCardBadgeLabel(match, { displayClock });
    return (
      <Badge variant="outline" className="border-red-300/70 bg-red-50 text-red-800">
        {label?.startsWith('En vivo') ? label : `En vivo${displayClock ? ` · ${displayClock}` : ''}`}
      </Badge>
    );
  }

  if (finalizingLive) {
    return (
      <Badge variant="outline" className="border-amber-300/70 bg-amber-50 text-amber-900">
        Finalizando…
      </Badge>
    );
  }

  if (isLive && weatherLabel) {
    return (
      <Badge variant="outline" className="border-red-300/70 bg-red-50 text-red-800">
        {displayClock ? `${displayClock}` : 'En pausa'}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="border-emerald-300/70 bg-emerald-50 text-emerald-900">
      Final{displayClock && displayClock !== 'Final' ? ` · ${displayClock}` : ''}
    </Badge>
  );
}

function ResultMatchCard({ match, variant = 'live' }) {
  const homeName = match.homeTeam?.nameEn || 'Local';
  const awayName = match.awayTeam?.nameEn || 'Visitante';
  const homeFlag = getTeamFlag(match.homeTeam);
  const awayFlag = getTeamFlag(match.awayTeam);
  const isArgentina = matchInvolvesArgentina(match);
  const isLive = variant === 'live';
  const weatherLabel = getWeatherOpsLabel(match.weatherOps);
  const playStateLabel = getMatchPlayStateLabel(match);
  const showWeatherLayer =
    isLive ||
    weatherLabel ||
    playStateLabel ||
    match.weatherRisk?.riskLevel === 'stop' ||
    match.weatherRisk?.riskLevel === 'high' ||
    match.liveScheduleContext?.integrityWarning;

  return (
    <Card className={cn(liveCardClassName(isArgentina), 'relative')}>
      {isLive ? <VenueCurrentWeatherCorner weather={match.weather} /> : null}
      <CardContent className="match-live-ui flex w-full flex-col items-center gap-2 p-4 text-center">
        {showWeatherLayer ? (
          <>
            <MatchPlayStateBadge match={match} />
            {!playStateLabel ? (
              <WeatherOpsBadge weatherOps={match.weatherOps} weatherRisk={match.weatherRisk} />
            ) : null}
            <LiveScheduleAlert liveScheduleContext={match.liveScheduleContext} className="w-full" />
          </>
        ) : null}
        <LiveStatusBadge
          match={match}
          isLive={isLive}
          weatherLabel={weatherLabel}
          playStateLabel={playStateLabel}
        />

        <MatchTeamsLayout
          homeName={homeName}
          awayName={awayName}
          homeFlag={homeFlag}
          awayFlag={awayFlag}
          homeScorers={match.homeScorers}
          awayScorers={match.awayScorers}
          homeBookings={match.homeBookings}
          awayBookings={match.awayBookings}
          homeSubstitutions={match.homeSubstitutions}
          awaySubstitutions={match.awaySubstitutions}
          center={<MatchScoreCenter match={match} />}
        />

        <span className="match-live-text-meta text-[11px] text-muted-foreground">
          Grupo {match.group} · {matchDateLabel(match)}
        </span>
        {isLive ? (
          <LiveMatchTrigger match={match} variant="outline" className="w-full sm:w-auto" />
        ) : null}
        <BroadcastBadges broadcasters={match.broadcasters} size="md" className="w-full" />
      </CardContent>
    </Card>
  );
}

function TimelineMatchCard({ match, variant = 'finished' }) {
  const [highlightKey, setHighlightKey] = useState(null);
  const homeName = match.homeTeam?.nameEn || 'Local';
  const awayName = match.awayTeam?.nameEn || 'Visitante';
  const homeFlag = getTeamFlag(match.homeTeam);
  const awayFlag = getTeamFlag(match.awayTeam);
  const homeCode = match.homeTeam?.fifaCode || 'LOC';
  const awayCode = match.awayTeam?.fifaCode || 'VIS';
  const isArgentina = matchInvolvesArgentina(match);
  const isLive = variant === 'live';
  const weatherLabel = getWeatherOpsLabel(match.weatherOps);
  const playStateLabel = getMatchPlayStateLabel(match);
  const showWeatherLayer =
    isLive ||
    weatherLabel ||
    playStateLabel ||
    match.weatherRisk?.riskLevel === 'stop' ||
    match.weatherRisk?.riskLevel === 'high' ||
    match.liveScheduleContext?.integrityWarning;
  const hasTimeline = (match.matchTimeline?.length ?? 0) > 0;
  const isInteractivePitch = shouldUseInteractivePitch(match, isLive ? 'live' : 'default');

  if (!hasTimeline) {
    return <ResultMatchCard match={match} variant={variant} />;
  }

  return (
    <Card className={cn(liveCardClassName(isArgentina), 'relative')}>
      {isLive ? <VenueCurrentWeatherCorner weather={match.weather} /> : null}
      <CardContent className="match-live-ui flex w-full flex-col items-center gap-2 p-4 text-center">
        {showWeatherLayer ? (
          <>
            <MatchPlayStateBadge match={match} />
            {!playStateLabel ? (
              <WeatherOpsBadge weatherOps={match.weatherOps} weatherRisk={match.weatherRisk} />
            ) : null}
            <LiveScheduleAlert liveScheduleContext={match.liveScheduleContext} className="w-full" />
          </>
        ) : null}
        <LiveStatusBadge
          match={match}
          isLive={isLive}
          weatherLabel={weatherLabel}
          playStateLabel={playStateLabel}
        />

        <div className="flex w-full flex-col gap-1.5">
          <FinishedTeamsHeader
            homeName={homeName}
            awayName={awayName}
            homeFlag={homeFlag}
            awayFlag={awayFlag}
            homeBookings={match.homeBookings}
            awayBookings={match.awayBookings}
            homeSubstitutions={match.homeSubstitutions}
            awaySubstitutions={match.awaySubstitutions}
            center={
              <MatchScoreCenter match={match} />
            }
          />

          <MatchTimeline
            events={match.matchTimeline}
            homeTeamCode={homeCode}
            awayTeamCode={awayCode}
            highlightKey={isInteractivePitch ? highlightKey : null}
            onHighlightKeyChange={isInteractivePitch ? setHighlightKey : undefined}
          />

          <PenaltyShootoutDisplay
            penaltyShootout={match.penaltyShootout}
            homeCode={homeCode}
            awayCode={awayCode}
          />
        </div>

        <MatchSummary
          events={match.matchTimeline}
          reportStats={match.fifaReportStats}
          homeCode={homeCode}
          awayCode={awayCode}
          status={match.status}
        />

        {shouldShowMatchLineup(match) ? (
          <MatchLineupSection
            match={match}
            mode={isLive ? 'live' : 'default'}
            events={match.matchTimeline}
            highlightKey={highlightKey}
            onHighlightKeyChange={setHighlightKey}
          />
        ) : null}

        <span className="match-live-text-meta text-[11px] text-muted-foreground">
          Grupo {match.group} · {matchDateLabel(match)}
        </span>
        {isLive ? (
          <LiveMatchTrigger match={match} variant="outline" className="w-full sm:w-auto" />
        ) : null}
        <BroadcastBadges broadcasters={match.broadcasters} size="md" className="w-full" />
      </CardContent>
    </Card>
  );
}

function LiveMatchCard({ match }) {
  return <TimelineMatchCard match={match} variant="live" />;
}

function FinishedMatchCard({ match }) {
  return <TimelineMatchCard match={match} variant="finished" />;
}

function FeaturedMatchCard({ match }) {
  if (match.status === 'finished') {
    return <FinishedMatchCard match={match} />;
  }
  return <LiveMatchCard match={match} />;
}

function CollapsedLiveMatchCard({ match, onExpand }) {
  return (
    <div className="flex flex-col gap-2">
      <div
        role="button"
        tabIndex={0}
        onClick={onExpand}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onExpand();
          }
        }}
        className="rounded-xl transition-shadow hover:ring-2 hover:ring-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-expanded="false"
        title="Expandir cronología y cancha"
      >
        <ResultMatchCard match={match} variant="live" />
      </div>
      <Button type="button" variant="outline" size="sm" className="w-full" onClick={onExpand}>
        <ChevronDown className="mr-1.5 size-4" aria-hidden />
        Ver cronología y cancha
      </Button>
    </div>
  );
}

function FeaturedMatchesGrid({
  liveMatches,
  recentFinishedMatches,
  expandedLiveMatchId,
  onExpandedLiveMatchChange,
}) {
  const featured = [...liveMatches, ...recentFinishedMatches];
  const hasMultipleLive = liveMatches.length > 1;
  if (!featured.length) return null;
  return (
    <div className={cn('grid w-full gap-4', matchBarGridClass())}>
      {featured.map((match) => {
        const isLive = match.status !== 'finished';
        const isCollapsedLive =
          isLive && hasMultipleLive && expandedLiveMatchId && match.id !== expandedLiveMatchId;

        return (
          <div key={match.id} className="min-w-0">
            {isCollapsedLive ? (
              <CollapsedLiveMatchCard
                match={match}
                onExpand={() => onExpandedLiveMatchChange?.(match.id)}
              />
            ) : (
              <FeaturedMatchCard match={match} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function PredictionClosedDialog({ match, open, onOpenChange }) {
  const dialogRef = useRef(null);
  const homeName = match.homeTeam?.nameEn || 'Local';
  const awayName = match.awayTeam?.nameEn || 'Visitante';

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  const handleClose = () => onOpenChange(false);

  return (
    <dialog
      ref={dialogRef}
      className="max-h-[90vh] w-[min(100%,28rem)] overflow-y-auto rounded-lg border border-border bg-card p-0 text-card-foreground shadow-lg backdrop:bg-black/40"
      onClose={handleClose}
      onCancel={handleClose}
      aria-labelledby="prediction-closed-title"
    >
      <Card className="border-0 shadow-none">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <DialogTitleWithIcon
              icon={PopupFubolIcon}
              id="prediction-closed-title"
              titleClassName="text-lg"
              iconLabel="Se acabó el tiempo, loco"
            >
              Predicción cerrada
            </DialogTitleWithIcon>
            <CardDescription>
              {homeName} vs {awayName}
              {match.group ? ` · Grupo ${match.group}` : ''}
            </CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handleClose}>
            Cerrar
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 pt-0 text-sm text-muted-foreground">
          <p>
            Las predicciones para este partido ya cerraron. Cierran 1 hora antes del comienzo del
            partido.
          </p>
          {match.kickoffAt ? (
            <p className="text-foreground">
              Inicio: <span className="font-medium">{matchDateLabel(match)}</span>
            </p>
          ) : null}
        </CardContent>
      </Card>
    </dialog>
  );
}

function NextMatchCard({ match }) {
  const navigate = useNavigate();
  const [closedDialogOpen, setClosedDialogOpen] = useState(false);
  const homeName = match.homeTeam?.nameEn || 'Local';
  const awayName = match.awayTeam?.nameEn || 'Visitante';
  const homeFlag = getTeamFlag(match.homeTeam);
  const awayFlag = getTeamFlag(match.awayTeam);
  const isArgentina = matchInvolvesArgentina(match);
  const predictionsOpen = match.predictionOpen !== false;

  const handleActivate = () => {
    if (predictionsOpen) {
      navigate(`/predictions?match=${encodeURIComponent(match.id)}`);
      return;
    }
    setClosedDialogOpen(true);
  };

  return (
    <>
      <Card
        role="button"
        tabIndex={0}
        onClick={handleActivate}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleActivate();
          }
        }}
        title={predictionsOpen ? 'Ir a predicciones' : 'Ver detalle de cierre'}
        className={cn(
          liveCardClassName(isArgentina),
          'cursor-pointer transition-shadow hover:ring-2 hover:ring-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
        )}
      >
        <CardContent className="match-live-ui flex w-full flex-col items-center gap-2 p-4 text-center">
          {predictionsOpen ? (
            <Badge variant="outline" className="border-sky-300/70 bg-sky-50 text-sky-900">
              Predicciones abiertas
            </Badge>
          ) : (
            <Badge variant="outline" className="border-amber-300/70 bg-amber-50 text-amber-900">
              Predicciones cerradas
            </Badge>
          )}

          <MatchTeamsLayout
            homeName={homeName}
            awayName={awayName}
            homeFlag={homeFlag}
            awayFlag={awayFlag}
            center={<span className="match-live-vs text-lg font-semibold text-muted-foreground">vs</span>}
          />

          <KickoffCountdown
            kickoffAt={match.kickoffAt}
            className="match-live-text text-sm font-medium text-foreground"
          />

          <span className="match-live-text-meta text-[11px] text-muted-foreground">
            {match.group ? `Grupo ${match.group} · ` : ''}
            {matchDateLabel(match)}
          </span>

          <MatchLineupSection match={match} />

          {!predictionsOpen ? (
            <div
              className="w-full"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <LiveMatchTrigger match={match} variant="outline" className="w-full sm:w-auto" />
            </div>
          ) : null}
          <BroadcastBadges broadcasters={match.broadcasters} size="md" className="w-full" />
        </CardContent>
      </Card>

      <PredictionClosedDialog
        match={match}
        open={closedDialogOpen}
        onOpenChange={setClosedDialogOpen}
      />
    </>
  );
}

function FinishedMatchesArchive({ matches }) {
  if (!matches.length) return null;

  return (
    <details className="group rounded-xl border border-border bg-muted/20">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
        <span>
          Partidos finalizados ({matches.length})
        </span>
        <ChevronDown
          className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="flex flex-col gap-4 border-t border-border p-3">
        {matches.map((match) => (
          <FinishedMatchCard key={match.id} match={match} />
        ))}
      </div>
    </details>
  );
}

function EmptyMatchesState() {
  return (
    <div className="mx-auto flex w-full flex-col">
      <Card className="w-full border-dashed">
        <CardContent className="flex flex-col items-center gap-1 py-5 text-center">
          <p className="text-sm font-medium text-foreground">Todavía no hay partidos para mostrar</p>
          <p className="text-sm text-muted-foreground">
            Cuando haya partidos en curso o próximos, van a aparecer acá con el resultado y el
            timeline de eventos.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function MatchColumn({ title, children }) {
  return (
    <div className="flex w-full flex-col gap-4">
      {title ? (
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
      ) : null}
      <div className="flex w-full flex-col gap-4">{children}</div>
    </div>
  );
}

export default function LiveMatchesBar({
  matches = [],
  recentFinishedMatches = [],
  nextMatches = [],
  finishedMatches = [],
  expandedLiveMatchId,
  onExpandedLiveMatchChange,
}) {
  const sortedLiveMatches = useMemo(() => sortLiveMatchesForFeaturedBar(matches), [matches]);
  const hasLive = sortedLiveMatches.length > 0;
  const hasRecentFinished = recentFinishedMatches.length > 0;
  const showRecentFinishedBar = hasRecentFinished;
  const hasNext = nextMatches.length > 0;
  const archiveMatches = useMemo(() => {
    const featuredIds = new Set([
      ...sortedLiveMatches.map((match) => match.id),
      ...recentFinishedMatches.map((match) => match.id),
    ]);
    return finishedMatches.filter((match) => !featuredIds.has(match.id));
  }, [finishedMatches, sortedLiveMatches, recentFinishedMatches]);
  const hasArchive = archiveMatches.length > 0;

  const liveColumnTitle = useMemo(
    () => resolveLiveMatchesColumnTitle(sortedLiveMatches),
    [sortedLiveMatches]
  );

  if (!hasLive && !showRecentFinishedBar && !hasNext && !hasArchive) {
    return <EmptyMatchesState />;
  }

  return (
    <div className="mx-auto flex w-full flex-col gap-6">
      {hasLive ? (
        <MatchColumn title={liveColumnTitle}>
          <FeaturedMatchesGrid
            liveMatches={sortedLiveMatches}
            recentFinishedMatches={[]}
            expandedLiveMatchId={expandedLiveMatchId}
            onExpandedLiveMatchChange={onExpandedLiveMatchChange}
          />
        </MatchColumn>
      ) : null}

      {showRecentFinishedBar ? (
        <MatchColumn
          title={
            recentFinishedMatches.length > 1
              ? 'Partidos recién finalizados'
              : 'Partido recién finalizado'
          }
        >
          <FeaturedMatchesGrid liveMatches={[]} recentFinishedMatches={recentFinishedMatches} />
        </MatchColumn>
      ) : null}

      {hasNext ? (
        <MatchColumn
          title={nextMatches.length > 1 ? 'Próximos partidos' : 'Próximo partido'}
        >
          {nextMatches.map((match) => (
            <NextMatchCard key={match.id} match={match} />
          ))}
        </MatchColumn>
      ) : null}

      {hasArchive ? <FinishedMatchesArchive matches={archiveMatches} /> : null}
    </div>
  );
}
