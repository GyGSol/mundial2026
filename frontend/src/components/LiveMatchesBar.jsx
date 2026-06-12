import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTeamFlag, matchInvolvesArgentina } from '@/lib/teamMeta';
import { filterTimelineForDisplay } from '@/lib/matchTimelineDisplay.js';
import { Badge } from '@/components/ui/badge.jsx';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card.jsx';
import { cn } from '@/lib/utils';
import { formatMatchDate } from '@/lib/dateFormat';
import {
  buildMatchSummaryRows,
  formatMatchAttendance,
  getMatchSummaryNotice,
} from '@/lib/matchSummary';
import BroadcastBadges from '@/components/BroadcastBadges.jsx';
import KickoffCountdown from '@/components/KickoffCountdown.jsx';
import MatchLiveAiPanel from '@/components/MatchLiveAiPanel.jsx';
import { Button } from '@/components/ui/button.jsx';

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
  return scorer.minute != null ? `${scorer.minute}' ${scorer.name}` : scorer.name;
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
  return `${minute}${cardSymbol(booking.card)} ${booking.player}`;
}

function formatSubstitutionLine(substitution) {
  if (!substitution?.playerOut || !substitution?.playerIn) return null;
  const minute = substitution.minute != null ? `${substitution.minute}' ` : '';
  return `${minute}${substitution.playerOut} → ${substitution.playerIn}`;
}

function TeamEventColumn({ lines, className }) {
  if (!lines.length) return null;

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-0.5 text-center text-[10px] leading-snug text-muted-foreground',
        className
      )}
    >
      {lines.map((line, index) => (
        <span key={index}>{line}</span>
      ))}
    </div>
  );
}

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
    <div className="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-x-3 gap-y-1">
      <div className="flex flex-col items-center gap-1 text-center">
        {homeFlag ? (
          <img src={homeFlag} alt={homeName} className="size-8 rounded-sm border object-cover" />
        ) : null}
        <span className="max-w-[5.5rem] truncate text-xs font-medium">{homeName}</span>
      </div>

      <div className="flex min-h-10 items-center justify-center self-center px-1">{center}</div>

      <div className="flex flex-col items-center gap-1 text-center">
        {awayFlag ? (
          <img src={awayFlag} alt={awayName} className="size-8 rounded-sm border object-cover" />
        ) : null}
        <span className="max-w-[5.5rem] truncate text-xs font-medium">{awayName}</span>
      </div>

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

function formatTimelineLine(event, homeCode, awayCode) {
  const code = event.side === 'home' ? homeCode : awayCode;
  const minute = formatTimelineMinute(event);

  switch (event.type) {
    case 'goal':
      return `${minute} ${code} ⚽ ${event.player}`;
    case 'yellow_card':
      return `${minute} ${code} 🟨 ${event.player}`;
    case 'red_card':
      return `${minute} ${code} 🟥 ${event.player}`;
    case 'substitution':
      return `${minute} ${code} ${event.playerOut} → ${event.playerIn}`;
    case 'foul':
      return `${minute} ${code} Falta ${event.player}`;
    case 'goal_disallowed':
      return minute ? `${minute} 🚫 Gol anulado` : '🚫 Gol anulado';
    default:
      return null;
  }
}

function MatchTimeline({ events = [], homeCode = 'LOC', awayCode = 'VIS' }) {
  const scrollRef = useRef(null);
  const displayEvents = filterTimelineForDisplay(events);
  const lines = displayEvents
    .map((event) => formatTimelineLine(event, homeCode, awayCode))
    .filter(Boolean);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [lines.length, events]);

  if (!lines.length) return null;

  return (
    <div
      ref={scrollRef}
      className="max-h-48 w-full overflow-y-auto rounded-md border bg-muted/30 px-2 py-1.5 text-left [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="flex flex-col gap-0.5 text-[10px] leading-snug text-muted-foreground">
        {lines.map((line, index) => (
          <span key={index}>{line}</span>
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
    <div className="w-full rounded-md border bg-muted/20 px-3 py-2 text-left">
      <p className="mb-2 text-center text-[11px] font-medium text-foreground">Resumen del partido</p>
      {notice ? (
        <p className="mb-2 text-center text-[10px] text-muted-foreground">{notice}</p>
      ) : null}
      {attendance ? (
        <p className="mb-2 text-center text-[10px] text-muted-foreground">
          Asistencia: {attendance}
        </p>
      ) : null}
      <div className="mb-1.5 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-[10px] font-medium text-muted-foreground">
        <span className="text-right">{homeCode}</span>
        <span className="text-center" aria-hidden="true" />
        <span className="text-left">{awayCode}</span>
      </div>
      <div className="flex flex-col gap-1">
        {rows.map((row) => (
          <div
            key={row.label}
            className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-[10px] leading-snug"
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

function FinishedTeamsHeader({ homeName, awayName, homeFlag, awayFlag, center }) {
  return (
    <div className="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-3">
      <div className="flex flex-col items-center gap-1 text-center">
        {homeFlag ? (
          <img src={homeFlag} alt={homeName} className="size-8 rounded-sm border object-cover" />
        ) : null}
        <span className="max-w-[5.5rem] truncate text-xs font-medium">{homeName}</span>
      </div>
      <div className="flex min-h-10 items-center justify-center px-1">{center}</div>
      <div className="flex flex-col items-center gap-1 text-center">
        {awayFlag ? (
          <img src={awayFlag} alt={awayName} className="size-8 rounded-sm border object-cover" />
        ) : null}
        <span className="max-w-[5.5rem] truncate text-xs font-medium">{awayName}</span>
      </div>
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

  return (
    <Card className={liveCardClassName(isArgentina)}>
      <CardContent className="flex w-full flex-col items-center gap-2 p-4 text-center">
        {isLive ? (
          <Badge variant="outline" className="border-red-300/70 bg-red-50 text-red-800">
            En vivo{match.timeElapsed ? ` · ${match.timeElapsed}` : ''}
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
            <div className="flex items-center gap-1 text-xl font-bold tabular-nums">
              <span>{match.homeScore}</span>
              <span className="text-muted-foreground">-</span>
              <span>{match.awayScore}</span>
            </div>
          }
        />

        <span className="text-[11px] text-muted-foreground">
          Grupo {match.group} · {formatMatchDate(match)}
        </span>
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
  const hasTimeline = (match.matchTimeline?.length ?? 0) > 0;

  if (!hasTimeline) {
    return <ResultMatchCard match={match} variant={variant} />;
  }

  return (
    <Card className={liveCardClassName(isArgentina)}>
      <CardContent className="flex w-full flex-col items-center gap-2 p-4 text-center">
        {isLive ? (
          <Badge variant="outline" className="border-red-300/70 bg-red-50 text-red-800">
            En vivo{match.timeElapsed ? ` · ${match.timeElapsed}` : ''}
          </Badge>
        ) : (
          <Badge variant="outline" className="border-emerald-300/70 bg-emerald-50 text-emerald-900">
            Final{match.timeElapsed && match.timeElapsed !== 'Final' ? ` · ${match.timeElapsed}` : ''}
          </Badge>
        )}

        <FinishedTeamsHeader
          homeName={homeName}
          awayName={awayName}
          homeFlag={homeFlag}
          awayFlag={awayFlag}
          center={
            <div className="flex items-center gap-1 text-xl font-bold tabular-nums">
              <span>{match.homeScore}</span>
              <span className="text-muted-foreground">-</span>
              <span>{match.awayScore}</span>
            </div>
          }
        />

        <MatchTimeline events={match.matchTimeline} homeCode={homeCode} awayCode={awayCode} />

        <MatchSummary
          events={match.matchTimeline}
          reportStats={match.fifaReportStats}
          homeCode={homeCode}
          awayCode={awayCode}
          status={match.status}
        />

        <MatchLiveAiPanel matchId={match.id} status={match.status} />

        <span className="text-[11px] text-muted-foreground">
          Grupo {match.group} · {formatMatchDate(match)}
        </span>
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
    >
      <Card className="border-0 shadow-none">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <CardTitle className="text-lg">Predicción cerrada</CardTitle>
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
              Kickoff: <span className="font-medium">{formatMatchDate(match)}</span>
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
        <CardContent className="flex w-full flex-col items-center gap-2 p-4 text-center">
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
            center={<span className="text-lg font-semibold text-muted-foreground">vs</span>}
          />

          <KickoffCountdown
            kickoffAt={match.kickoffAt}
            className="text-sm font-medium text-foreground"
          />

          <span className="text-[11px] text-muted-foreground">
            {match.group ? `Grupo ${match.group} · ` : ''}
            {formatMatchDate(match)}
          </span>
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
            Cuando haya partidos en curso, próximos o finalizados, van a aparecer acá con el
            resultado y el timeline de eventos.
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
  finishedMatches = [],
  nextMatches = [],
}) {
  const hasLive = matches.length > 0;
  const hasFinished = finishedMatches.length > 0;
  const hasNext = nextMatches.length > 0;

  if (hasLive || hasFinished || hasNext) {
    return (
      <div className="mx-auto flex w-full flex-col gap-6">
        {hasLive ? (
          <MatchColumn title="Partidos en curso">
            {matches.map((match) => (
              <LiveMatchCard key={match.id} match={match} />
            ))}
          </MatchColumn>
        ) : null}

        {hasNext || hasFinished ? (
          <MatchColumn
            title={
              hasNext
                ? nextMatches.length > 1
                  ? 'Próximos partidos'
                  : 'Próximo partido'
                : 'Últimos resultados'
            }
          >
            {nextMatches.map((match) => (
              <NextMatchCard key={match.id} match={match} />
            ))}
            {finishedMatches.map((match) => (
              <FinishedMatchCard key={match.id} match={match} />
            ))}
          </MatchColumn>
        ) : null}
      </div>
    );
  }

  return <EmptyMatchesState />;
}
