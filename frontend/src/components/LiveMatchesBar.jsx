import { getTeamFlag, matchInvolvesArgentina } from '@/lib/teamMeta';
import { Badge } from '@/components/ui/badge.jsx';
import { Card, CardContent } from '@/components/ui/card.jsx';
import { cn } from '@/lib/utils';
import { formatMatchDate } from '@/lib/dateFormat';
import BroadcastBadges from '@/components/BroadcastBadges.jsx';
import KickoffCountdown from '@/components/KickoffCountdown.jsx';

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
    'w-full max-w-md shrink-0',
    isArgentina && 'border-sky-300/80 bg-sky-50/95 ring-1 ring-sky-200/90'
  );

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

function LiveMatchCard({ match }) {
  return <ResultMatchCard match={match} variant="live" />;
}

function FinishedMatchCard({ match }) {
  return <ResultMatchCard match={match} variant="finished" />;
}

function NextMatchCard({ match }) {
  const homeName = match.homeTeam?.nameEn || 'Local';
  const awayName = match.awayTeam?.nameEn || 'Visitante';
  const homeFlag = getTeamFlag(match.homeTeam);
  const awayFlag = getTeamFlag(match.awayTeam);
  const isArgentina = matchInvolvesArgentina(match);

  return (
    <Card className={liveCardClassName(isArgentina)}>
      <CardContent className="flex w-full flex-col items-center gap-2 p-4 text-center">
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
  );
}

function EmptyMatchesState() {
  return (
    <div className="flex justify-center">
      <Card className="w-full max-w-xl border-dashed">
        <CardContent className="flex flex-col items-center gap-1 py-5 text-center">
          <p className="text-sm font-medium text-foreground">Todavía no hay partidos para mostrar</p>
          <p className="text-sm text-muted-foreground">
            Cuando cierren las predicciones (1 hora antes del inicio), los próximos partidos van a
            aparecer acá. Los que terminen se quedan visibles con el resultado completo.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function MatchSection({ title, count, children }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <MatchesRow count={count}>{children}</MatchesRow>
    </div>
  );
}

function MatchesRow({ count, children }) {
  const isSingle = count === 1;

  return (
    <div
      className={cn(
        'flex w-full gap-3 pb-1',
        isSingle
          ? 'justify-center'
          : '-mx-4 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
      )}
    >
      {children}
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
      <div className="flex flex-col items-center gap-6">
        {hasLive ? (
          <MatchSection title="Partidos en curso" count={matches.length}>
            {matches.map((match) => (
              <LiveMatchCard key={match.id} match={match} />
            ))}
          </MatchSection>
        ) : null}

        {hasFinished ? (
          <MatchSection title="Últimos resultados" count={finishedMatches.length}>
            {finishedMatches.map((match) => (
              <FinishedMatchCard key={match.id} match={match} />
            ))}
          </MatchSection>
        ) : null}

        {hasNext ? (
          <MatchSection
            title={nextMatches.length > 1 ? 'Próximos partidos' : 'Próximo partido'}
            count={nextMatches.length}
          >
            {nextMatches.map((match) => (
              <NextMatchCard key={match.id} match={match} />
            ))}
          </MatchSection>
        ) : null}
      </div>
    );
  }

  return <EmptyMatchesState />;
}
