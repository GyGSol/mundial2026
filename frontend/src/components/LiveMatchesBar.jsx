import { ArrowDown, ArrowUp } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DialogTitleWithIcon from '@/components/DialogTitleWithIcon.jsx';
import { BrokenLegIcon } from '@/components/icons/BrokenLegIcon.jsx';
import { PopupClosedIcon } from '@/components/icons/popup/index.js';
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
  formatSummaryPlayer,
  formatTimelinePlayer,
} from '@/lib/playerPositionLabel.js';
import KickoffCountdown from '@/components/KickoffCountdown.jsx';
import { Button } from '@/components/ui/button.jsx';

import BroadcastBadges from '@/components/BroadcastBadges.jsx';
import LiveMatchTrigger from '@/components/live/LiveMatchTrigger.jsx';
import WeatherOpsBadge, { getWeatherOpsLabel, LiveScheduleAlert } from '@/components/WeatherOpsBadge.jsx';

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
  return scorer.minute != null ? `${scorer.minute}' ${label}` : label;
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

function SubstitutionTimelineRow({ minutePrefix, playerOut, playerIn, align = 'center' }) {
  return (
    <span
      className={cn(
        'inline-flex flex-wrap items-center gap-x-1 gap-y-0.5',
        align === 'right' && 'justify-end',
        align === 'left' && 'justify-start',
        align === 'center' && 'justify-center'
      )}
    >
      {minutePrefix ? <span>{minutePrefix}</span> : null}
      <ArrowDown className="match-live-icon size-3 shrink-0 text-red-500" strokeWidth={2.75} aria-hidden="true" />
      <span>{playerOut}</span>
      <ArrowUp className="match-live-icon size-3 shrink-0 text-emerald-500" strokeWidth={2.75} aria-hidden="true" />
      <span>{playerIn}</span>
    </span>
  );
}

function FoulTimelineRow({ minutePrefix, label }) {
  return (
    <span className="inline-flex flex-wrap items-center justify-center gap-x-1 gap-y-0.5">
      {minutePrefix ? <span>{minutePrefix}</span> : null}
      <BrokenLegIcon />
      <span>{label}</span>
    </span>
  );
}

function TimelineEntryContent({ entry }) {
  if (entry.kind === 'substitution') {
    return (
      <SubstitutionTimelineRow
        minutePrefix={entry.minutePrefix}
        playerOut={entry.playerOut}
        playerIn={entry.playerIn}
        align="center"
      />
    );
  }

  if (entry.kind === 'foul') {
    return <FoulTimelineRow minutePrefix={entry.minutePrefix} label={entry.label} />;
  }

  return entry.text;
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
  const prefix = minute ? `${minute} ` : '';
  const neutralLabel = formatNeutralTimelineLabel(event);

  if (neutralLabel) {
    return {
      side: 'neutral',
      text: `${prefix}${neutralTimelineIcon(event.type)} ${neutralLabel}`.trim(),
    };
  }

  switch (event.type) {
    case 'goal': {
      const playerLabel = event.player ? formatTimelinePlayer(event) : 'Gol';
      const penaltySuffix = event.isPenalty ? ' (p)' : '';
      const shotPrefix = event.includesShot ? '🎯 ' : '';
      return {
        side: event.side,
        text: `${prefix}${shotPrefix}⚽ ${playerLabel}${penaltySuffix}`,
      };
    }
    case 'yellow_card':
      return {
        side: event.side,
        text: `${prefix}🟨 ${formatTimelinePlayer(event)}`,
      };
    case 'red_card':
      return {
        side: event.side,
        text: `${prefix}🟥 ${formatTimelinePlayer(event)}`,
      };
    case 'substitution':
      return {
        side: event.side,
        kind: 'substitution',
        minutePrefix: prefix,
        playerOut: formatTimelinePlayer(event, 'out'),
        playerIn: formatTimelinePlayer(event, 'in'),
      };
    case 'foul':
      return {
        side: event.side,
        kind: 'foul',
        minutePrefix: prefix,
        label: event.player
          ? `Falta · ${formatTimelinePlayer(event)}`
          : 'Falta',
      };
    case 'shot_attempt':
      return {
        side: event.side,
        text: `${prefix}🎯 ${event.player ? `Tiro · ${formatTimelinePlayer(event)}` : 'Tiro'}`,
      };
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

function MatchTimeline({ events = [] }) {
  const scrollRef = useRef(null);
  const signature = useMemo(() => timelineEventsSignature(events), [events]);
  const lastSignatureRef = useRef(signature);
  const [displayEvents, setDisplayEvents] = useState(events);

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
          return { ...entry, key: timelineEventIdentity(event) };
        })
        .filter(Boolean),
    [displayEvents]
  );

  if (!displayEntries.length) return null;

  return (
    <div
      ref={scrollRef}
      className="match-live-timeline max-h-60 w-full overflow-y-auto rounded-md border bg-muted/30 py-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="flex flex-col gap-0.5 match-live-text text-[10px] leading-snug text-muted-foreground">
        {displayEntries.map((entry) => (
          <div key={entry.key} className={MATCH_SIDE_GRID_CLASS}>
            <div className={cn(MATCH_SIDE_CELL_CLASS, 'min-w-0')}>
              {entry.side === 'home' ? (
                <span className="match-live-entry max-w-[9rem] break-words sm:max-w-[11rem]">
                  <TimelineEntryContent entry={entry} />
                </span>
              ) : null}
            </div>
            <div className={MATCH_CENTER_CELL_CLASS}>
              {entry.side === 'neutral' ? (
                <span className="match-live-center-entry max-w-[7rem] break-words">{entry.text}</span>
              ) : null}
            </div>
            <div className={cn(MATCH_SIDE_CELL_CLASS, 'min-w-0')}>
              {entry.side === 'away' ? (
                <span className="match-live-entry max-w-[9rem] break-words sm:max-w-[11rem]">
                  <TimelineEntryContent entry={entry} />
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
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

function ResultMatchCard({ match, variant = 'live' }) {
  const homeName = match.homeTeam?.nameEn || 'Local';
  const awayName = match.awayTeam?.nameEn || 'Visitante';
  const homeFlag = getTeamFlag(match.homeTeam);
  const awayFlag = getTeamFlag(match.awayTeam);
  const isArgentina = matchInvolvesArgentina(match);
  const isLive = variant === 'live';
  const weatherLabel = getWeatherOpsLabel(match.weatherOps);
  const showLiveBadge = isLive && !weatherLabel;
  const showWeatherLayer =
    isLive ||
    weatherLabel ||
    match.weatherRisk?.riskLevel === 'stop' ||
    match.weatherRisk?.riskLevel === 'high' ||
    match.liveScheduleContext?.integrityWarning;

  return (
    <Card className={liveCardClassName(isArgentina)}>
      <CardContent className="match-live-ui flex w-full flex-col items-center gap-2 p-4 text-center">
        {showWeatherLayer ? (
          <>
            <WeatherOpsBadge weatherOps={match.weatherOps} weatherRisk={match.weatherRisk} />
            <LiveScheduleAlert liveScheduleContext={match.liveScheduleContext} className="w-full" />
          </>
        ) : null}
        {showLiveBadge ? (
          <Badge variant="outline" className="border-red-300/70 bg-red-50 text-red-800">
            En vivo{match.timeElapsed ? ` · ${match.timeElapsed}` : ''}
          </Badge>
        ) : isLive && weatherLabel ? (
          <Badge variant="outline" className="border-red-300/70 bg-red-50 text-red-800">
            {match.timeElapsed ? `${match.timeElapsed}` : 'En pausa'}
          </Badge>
        ) : (
          <Badge variant="outline" className="border-emerald-300/70 bg-emerald-50 text-emerald-900">
            Final{match.timeElapsed && match.timeElapsed !== 'Final' ? ` · ${match.timeElapsed}` : ''}
          </Badge>
        )}

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
          center={
            <div className="match-live-score flex items-center gap-1 text-xl font-bold tabular-nums">
              <span>{match.homeScore}</span>
              <span className="text-muted-foreground">-</span>
              <span>{match.awayScore}</span>
            </div>
          }
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
  const homeName = match.homeTeam?.nameEn || 'Local';
  const awayName = match.awayTeam?.nameEn || 'Visitante';
  const homeFlag = getTeamFlag(match.homeTeam);
  const awayFlag = getTeamFlag(match.awayTeam);
  const homeCode = match.homeTeam?.fifaCode || 'LOC';
  const awayCode = match.awayTeam?.fifaCode || 'VIS';
  const isArgentina = matchInvolvesArgentina(match);
  const isLive = variant === 'live';
  const weatherLabel = getWeatherOpsLabel(match.weatherOps);
  const showLiveBadge = isLive && !weatherLabel;
  const showWeatherLayer =
    isLive ||
    weatherLabel ||
    match.weatherRisk?.riskLevel === 'stop' ||
    match.weatherRisk?.riskLevel === 'high' ||
    match.liveScheduleContext?.integrityWarning;
  const hasTimeline = (match.matchTimeline?.length ?? 0) > 0;

  if (!hasTimeline) {
    return <ResultMatchCard match={match} variant={variant} />;
  }

  return (
    <Card className={liveCardClassName(isArgentina)}>
      <CardContent className="match-live-ui flex w-full flex-col items-center gap-2 p-4 text-center">
        {showWeatherLayer ? (
          <>
            <WeatherOpsBadge weatherOps={match.weatherOps} weatherRisk={match.weatherRisk} />
            <LiveScheduleAlert liveScheduleContext={match.liveScheduleContext} className="w-full" />
          </>
        ) : null}
        {showLiveBadge ? (
          <Badge variant="outline" className="border-red-300/70 bg-red-50 text-red-800">
            En vivo{match.timeElapsed ? ` · ${match.timeElapsed}` : ''}
          </Badge>
        ) : isLive && weatherLabel ? (
          <Badge variant="outline" className="border-red-300/70 bg-red-50 text-red-800">
            {match.timeElapsed ? `${match.timeElapsed}` : 'En pausa'}
          </Badge>
        ) : (
          <Badge variant="outline" className="border-emerald-300/70 bg-emerald-50 text-emerald-900">
            Final{match.timeElapsed && match.timeElapsed !== 'Final' ? ` · ${match.timeElapsed}` : ''}
          </Badge>
        )}

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
              <div className="match-live-score flex items-center gap-1 text-xl font-bold tabular-nums">
                <span>{match.homeScore}</span>
                <span className="text-muted-foreground">-</span>
                <span>{match.awayScore}</span>
              </div>
            }
          />

          <MatchTimeline events={match.matchTimeline} />
        </div>

        <MatchSummary
          events={match.matchTimeline}
          reportStats={match.fifaReportStats}
          homeCode={homeCode}
          awayCode={awayCode}
          status={match.status}
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

function LiveMatchCard({ match }) {
  return <TimelineMatchCard match={match} variant="live" />;
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
              icon={PopupClosedIcon}
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
              Kickoff: <span className="font-medium">{matchDateLabel(match)}</span>
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
  nextMatches = [],
}) {
  const hasLive = matches.length > 0;
  const hasNext = nextMatches.length > 0;

  if (hasLive || hasNext) {
    return (
      <div className="mx-auto flex w-full flex-col gap-6">
        {hasLive ? (
          <MatchColumn title="Partidos en curso">
            {matches.map((match) => (
              <LiveMatchCard key={match.id} match={match} />
            ))}
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
      </div>
    );
  }

  return <EmptyMatchesState />;
}
