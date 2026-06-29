import { Badge } from '@/components/ui/badge.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table.jsx';
import { cn } from '@/lib/utils';
import { getGroupRowBorderStyle } from '@/lib/groupColors.js';
import { QualificationLegend } from '@/components/worldcup/GroupColorUi.jsx';
import ThirdPlaceStandingsSection from '@/components/worldcup/ThirdPlaceStandingsSection.jsx';
import { getTeamFlag } from '@/lib/teamMeta';
import { sortMatchesBySchedule } from '@/lib/matchSort.js';
import { ARGENTINA_TIMEZONE, formatMatchDate } from '@/lib/dateFormat';

const matchDateLabel = (match) =>
  formatMatchDate(match, { showTimezone: true, timeZone: ARGENTINA_TIMEZONE });
import BroadcastBadges from '@/components/BroadcastBadges.jsx';
import MatchTeamSide from '@/components/worldcup/MatchTeamSide.jsx';
import { PenaltyShootoutScoreLine } from '@/components/PenaltyShootoutDisplay.jsx';
import { resolveFieldMatchScores } from '@/lib/matchDisplayScore.js';

function TeamCell({ team, fallback = '—' }) {
  const name = team?.nameEn || fallback;
  const flagUrl = getTeamFlag(team);

  return (
    <div className="flex items-center gap-2">
      {flagUrl ? (
        <img src={flagUrl} alt="" className="size-5 rounded-sm border border-border/60 object-cover" />
      ) : team?.flag ? (
        <span>{team.flag}</span>
      ) : null}
      <span className="font-medium">{name}</span>
      {team?.fifaCode && <span className="text-xs text-muted-foreground">{team.fifaCode}</span>}
    </div>
  );
}

function MatchScore({ match }) {
  const statusClass =
    match.status === 'live'
      ? 'text-emerald-700'
      : match.status === 'finished'
        ? 'text-foreground'
        : 'text-muted-foreground';

  const { homeScore, awayScore } = resolveFieldMatchScores(match);
  const scoreText =
    match.status === 'upcoming' ? 'vs' : `${homeScore} - ${awayScore}`;

  return (
    <div className="flex flex-col items-start gap-1 rounded-lg border border-border/70 bg-card px-3 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
      <div className="min-w-0 sm:min-w-[140px] sm:flex-1">
        <MatchTeamSide
          team={match.homeTeam}
          slotLabel={match.homeTeamSlotLabel}
          slotSourceMatch={match.homeTeamSlotSourceMatch}
        />
      </div>
      <div className={cn('flex flex-col items-center font-semibold tabular-nums sm:px-2 sm:text-center', statusClass)}>
        <span>{scoreText}</span>
        <PenaltyShootoutScoreLine penaltyShootout={match.penaltyShootout} className="font-normal" />
      </div>
      <div className="min-w-0 sm:min-w-[140px] sm:flex-1 sm:text-right">
        <div className="sm:hidden">
          <MatchTeamSide
            team={match.awayTeam}
            slotLabel={match.awayTeamSlotLabel}
            slotSourceMatch={match.awayTeamSlotSourceMatch}
          />
        </div>
        <div className="hidden sm:block">
          <MatchTeamSide
            team={match.awayTeam}
            slotLabel={match.awayTeamSlotLabel}
            slotSourceMatch={match.awayTeamSlotSourceMatch}
            align="right"
          />
        </div>
      </div>
    </div>
  );
}

function StandingsTeamCell({ team, fallback = '—', isLive = false }) {
  const name = team?.nameEn || fallback;
  const flagUrl = getTeamFlag(team);
  const flag = flagUrl ? (
    <img src={flagUrl} alt="" className="size-4 shrink-0 rounded-sm border border-border/60 object-cover sm:size-5" />
  ) : team?.flag ? (
    <span className="shrink-0 text-sm">{team.flag}</span>
  ) : null;

  const liveBadge = isLive ? (
    <Badge
      variant="outline"
      className="shrink-0 border-emerald-300/70 bg-emerald-50 px-1 py-0 text-[9px] font-medium uppercase text-emerald-800"
    >
      En vivo
    </Badge>
  ) : null;

  return (
    <>
      <div className="flex items-center gap-1 sm:hidden">
        {flag}
        <span className="font-medium">{team?.fifaCode || name.slice(0, 3).toUpperCase()}</span>
        {liveBadge}
      </div>
      <div className="hidden min-w-0 items-center gap-1.5 sm:flex">
        {flag}
        <span className="truncate font-medium" title={name}>
          {name}
        </span>
        {liveBadge}
        {team?.fifaCode && (
          <span className="shrink-0 text-xs text-muted-foreground">{team.fifaCode}</span>
        )}
      </div>
    </>
  );
}

const standingsStatHead =
  'w-7 px-0.5 text-center text-[10px] font-medium sm:w-8 sm:px-1 sm:text-xs md:w-9';
const standingsStatCell =
  'w-7 px-0.5 py-1.5 text-center tabular-nums text-xs sm:w-8 sm:px-1 sm:py-2 sm:text-sm md:w-9';
const standingsOptionalCol = 'hidden sm:table-cell';

export function GroupStandingsSection({ groups, thirdPlaceStandings, teamMap, onGroupClick }) {
  if (!groups?.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Todavía no hay datos de grupos sincronizados.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <QualificationLegend />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {groups.map((group) => (
        <Card
          key={group.group}
          className={cn(
            'min-w-0',
            onGroupClick &&
              'cursor-pointer transition-colors hover:bg-muted/20 active:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          )}
          onClick={onGroupClick ? () => onGroupClick(group.group) : undefined}
          onKeyDown={
            onGroupClick
              ? (event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onGroupClick(group.group);
                  }
                }
              : undefined
          }
          tabIndex={onGroupClick ? 0 : undefined}
          role={onGroupClick ? 'button' : undefined}
          aria-label={onGroupClick ? `Ver partidos del grupo ${group.group}` : undefined}
        >
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between gap-2 text-base">
              <span>Grupo {group.group}</span>
              {onGroupClick ? (
                <span className="text-xs font-normal text-primary">Ver partidos →</span>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-2 sm:px-4">
            <table className="w-full table-fixed caption-bottom text-sm">
              <thead className="[&_tr]:border-b">
                <tr className="border-b border-border">
                  <th className="h-9 w-7 px-0.5 text-center align-middle text-[10px] font-medium text-muted-foreground sm:w-8 sm:text-xs">
                    #
                  </th>
                  <th className="h-9 min-w-0 px-1 text-left align-middle text-xs font-medium text-muted-foreground sm:px-2 sm:text-sm">
                    Equipo
                  </th>
                  <th className={standingsStatHead}>PJ</th>
                  <th className={standingsStatHead}>PG</th>
                  <th className={cn(standingsStatHead, standingsOptionalCol)}>PE</th>
                  <th className={cn(standingsStatHead, standingsOptionalCol)}>PP</th>
                  <th className={standingsStatHead}>GF</th>
                  <th className={cn(standingsStatHead, standingsOptionalCol)}>GC</th>
                  <th className={standingsStatHead}>DG</th>
                  <th className={cn(standingsStatHead, 'font-semibold text-foreground')}>Pts</th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {group.standings.map((row) => {
                  const isLiveTeam = group.liveTeamIds?.includes(row.teamId);

                  return (
                  <tr
                    key={row.teamId || row.rank}
                    className={cn(
                      'border-b border-border border-l-solid transition-colors hover:bg-muted/50',
                      isLiveTeam && 'bg-emerald-50/40'
                    )}
                    style={getGroupRowBorderStyle(group.group, row.rank)}
                  >
                    <td className="w-7 px-0.5 py-1.5 text-center align-middle text-xs text-muted-foreground sm:w-8 sm:py-2">
                      {row.rank}
                    </td>
                    <td className="min-w-0 px-1 py-1.5 align-middle sm:px-2 sm:py-2">
                      <StandingsTeamCell team={row} fallback={row.nameEn} isLive={isLiveTeam} />
                    </td>
                    <td className={standingsStatCell}>{row.played}</td>
                    <td className={standingsStatCell}>{row.won}</td>
                    <td className={cn(standingsStatCell, standingsOptionalCol)}>{row.drawn}</td>
                    <td className={cn(standingsStatCell, standingsOptionalCol)}>{row.lost}</td>
                    <td className={standingsStatCell}>{row.goalsFor}</td>
                    <td className={cn(standingsStatCell, standingsOptionalCol)}>{row.goalsAgainst}</td>
                    <td className={standingsStatCell}>{row.goalDiff}</td>
                    <td className={cn(standingsStatCell, 'font-semibold')}>{row.points}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}
      </div>

      <ThirdPlaceStandingsSection
        thirdPlaceStandings={thirdPlaceStandings}
        teamMap={teamMap}
      />
    </div>
  );
}

export function KnockoutSection({ phases }) {
  if (!phases?.length) {
    return (
      <p className="text-sm text-muted-foreground">
        La fase final todavía no tiene partidos publicados en la API.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {phases.map((phase) => (
        <Card key={phase.key}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{phase.label}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {phase.matches.map((match) => (
              <div key={match.externalId} className="flex flex-col gap-1">
                <MatchScore match={match} />
                <div className="flex flex-wrap items-center gap-2 px-1 text-xs text-muted-foreground">
                  <Badge variant="secondary">{match.status}</Badge>
                  {matchDateLabel(match) && <span>{matchDateLabel(match)}</span>}
                  {match.stadium?.nameEn && (
                    <span>
                      {match.stadium.nameEn}
                      {match.stadium.city ? ` · ${match.stadium.city}` : ''}
                    </span>
                  )}
                  <BroadcastBadges broadcasters={match.broadcasters} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function StatsSection({ stats, teams, stadiums, tournament2026PlayerStats }) {
  if (!stats) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumen del torneo</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <StatItem label="Equipos" value={stats.teams ?? teams?.length ?? 0} />
          <StatItem label="Partidos totales" value={stats.matches.total} />
          <StatItem label="Finalizados" value={stats.matches.finished} />
          <StatItem label="En vivo" value={stats.matches.live} />
          <StatItem label="Próximos" value={stats.matches.upcoming} />
          <StatItem label="Goles totales" value={stats.goals.total} />
          <StatItem label="Promedio por partido" value={stats.goals.averagePerMatch} />
          <StatItem label="Empates" value={stats.goals.draws} />
          <StatItem label="Victorias local" value={stats.goals.homeWins} />
          <StatItem label="Victorias visitante" value={stats.goals.awayWins} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Goleadores del Mundial 2026</CardTitle>
        </CardHeader>
        <CardContent>
          {tournament2026PlayerStats?.leaders?.length ? (
            <ul className="flex flex-col gap-2 text-sm">
              {tournament2026PlayerStats.leaders.map((row) => (
                <li key={row.playerId} className="flex items-center justify-between gap-2">
                  <TeamCell team={{ nameEn: row.fullName, fifaCode: row.fifaCode, flag: row.flag }} />
                  <span className="font-semibold tabular-nums">{row.goals} goles</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              {tournament2026PlayerStats?.note ??
                'Los goleadores se actualizarán cuando haya partidos finalizados con datos de jugadores.'}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Máximo goleador por equipo</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.goals.topScoringTeams?.length ? (
            <ul className="flex flex-col gap-2 text-sm">
              {stats.goals.topScoringTeams.map((row) => (
                <li key={row.teamId} className="flex items-center justify-between">
                  <TeamCell team={row} />
                  <span className="font-semibold tabular-nums">{row.goals} goles</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Sin goles registrados todavía.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Goles por grupo</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.goals.byGroup?.length ? (
            <ul className="flex flex-col gap-2 text-sm">
              {stats.goals.byGroup.map((row) => (
                <li key={row.group} className="flex items-center justify-between">
                  <span>Grupo {row.group}</span>
                  <span className="font-semibold tabular-nums">{row.goals}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Sin datos de grupos todavía.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Partido con más goles</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {stats.goals.highestScoringMatch ? (
            <p>
              Resultado{' '}
              <strong className="text-foreground">
                {stats.goals.highestScoringMatch.homeScore}-
                {stats.goals.highestScoringMatch.awayScore}
              </strong>{' '}
              ({stats.goals.highestScoringMatch.totalGoals} goles)
              {matchDateLabel(stats.goals.highestScoringMatch) &&
                ` · ${matchDateLabel(stats.goals.highestScoringMatch)}`}
            </p>
          ) : (
            'Sin partidos finalizados todavía.'
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Estadios</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {stadiums?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Estadio</TableHead>
                  <TableHead>Ciudad</TableHead>
                  <TableHead className="text-center">Capacidad</TableHead>
                  <TableHead className="text-center">Partidos</TableHead>
                  <TableHead className="text-center">Goles</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stadiums.map((stadium) => (
                  <TableRow key={stadium.externalId}>
                    <TableCell>{stadium.nameEn || stadium.externalId}</TableCell>
                    <TableCell>
                      {[stadium.city, stadium.country].filter(Boolean).join(', ') || '—'}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      {stadium.capacity ? stadium.capacity.toLocaleString('es-AR') : '—'}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">{stadium.matchesHosted}</TableCell>
                    <TableCell className="text-center tabular-nums">{stadium.goalsScored}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="px-6 text-sm text-muted-foreground">
              Los estadios se sincronizan junto con equipos y grupos.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function TeamsSection({ teams }) {
  if (!teams?.length) {
    return <p className="text-sm text-muted-foreground">No hay equipos sincronizados.</p>;
  }

  const byGroup = teams.reduce((acc, team) => {
    const group = team.group || '—';
    if (!acc[group]) acc[group] = [];
    acc[group].push(team);
    return acc;
  }, {});

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Object.entries(byGroup)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([group, groupTeams]) => (
          <Card key={group}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Grupo {group}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {groupTeams.map((team) => (
                <TeamCell key={team.externalId} team={team} />
              ))}
            </CardContent>
          </Card>
        ))}
    </div>
  );
}

function getMatchMetaParts(match) {
  const localDate = matchDateLabel(match);
  const localDateHasGroupAndMatchday =
    localDate &&
    /fecha\s+\S+/i.test(localDate) &&
    /grupo\s+\S+/i.test(localDate);

  if (localDateHasGroupAndMatchday) {
    return [localDate, match.stadium?.nameEn].filter(Boolean);
  }

  const parts = [];
  if (match.group) parts.push(`Grupo ${match.group}`);
  if (match.matchday) parts.push(`Fecha ${match.matchday}`);
  if (localDate) parts.push(localDate);
  if (match.stadium?.nameEn) parts.push(match.stadium.nameEn);
  return parts;
}

function sortMatchesForPartidos(matches = []) {
  return sortMatchesBySchedule(matches);
}

export function GroupMatchesSection({ matches }) {
  if (!matches?.length) {
    return (
      <p className="text-sm text-muted-foreground">No hay partidos de fase de grupos cargados.</p>
    );
  }

  const sortedMatches = sortMatchesForPartidos(matches);

  return (
    <div className="flex flex-col gap-3">
      {sortedMatches.map((match) => (
        <div
          key={match.externalId}
          className="flex flex-col gap-2 rounded-lg border border-border/70 bg-card p-3"
        >
          <MatchScore match={match} />
          <div className="flex flex-wrap items-center gap-2 px-1 text-xs text-muted-foreground">
            {getMatchMetaParts(match).map((part) => (
              <span key={part}>{part}</span>
            ))}
            <BroadcastBadges broadcasters={match.broadcasters} />
          </div>
        </div>
      ))}
    </div>
  );
}

function StatItem({ label, value }) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value ?? '—'}</p>
    </div>
  );
}
