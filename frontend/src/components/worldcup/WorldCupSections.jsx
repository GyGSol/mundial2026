import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge.jsx';
import MatchPredictionRankingsTable from '@/components/MatchPredictionRankingsTable.jsx';
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
import { getTeamFlag } from '@/lib/teamMeta';

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

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-card px-3 py-2">
      <div className="min-w-[140px] flex-1">
        <TeamCell team={match.homeTeam} />
      </div>
      <div className={cn('px-2 text-center font-semibold tabular-nums', statusClass)}>
        {match.status === 'upcoming' ? 'vs' : `${match.homeScore} - ${match.awayScore}`}
      </div>
      <div className="min-w-[140px] flex-1 text-right">
        <div className="flex items-center justify-end gap-2">
          {match.awayTeam?.fifaCode && (
            <span className="text-xs text-muted-foreground">{match.awayTeam.fifaCode}</span>
          )}
          <span className="font-medium">{match.awayTeam?.nameEn || '—'}</span>
          {getTeamFlag(match.awayTeam) ? (
            <img
              src={getTeamFlag(match.awayTeam)}
              alt=""
              className="size-5 rounded-sm border border-border/60 object-cover"
            />
          ) : match.awayTeam?.flag ? (
            <span>{match.awayTeam.flag}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function GroupStandingsSection({ groups }) {
  if (!groups?.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Todavía no hay datos de grupos sincronizados.
      </p>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {groups.map((group) => (
        <Card key={group.group}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span>Grupo {group.group}</span>
              <Badge variant="outline">{group.source === 'api' ? 'API' : 'Calculada'}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8 px-2">#</TableHead>
                  <TableHead>Equipo</TableHead>
                  <TableHead className="px-2 text-center">PJ</TableHead>
                  <TableHead className="px-2 text-center">PG</TableHead>
                  <TableHead className="px-2 text-center">PE</TableHead>
                  <TableHead className="px-2 text-center">PP</TableHead>
                  <TableHead className="px-2 text-center">GF</TableHead>
                  <TableHead className="px-2 text-center">GC</TableHead>
                  <TableHead className="px-2 text-center">DG</TableHead>
                  <TableHead className="px-2 text-center">Pts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.standings.map((row) => (
                  <TableRow key={row.teamId || row.rank}>
                    <TableCell className="px-2 text-center text-muted-foreground">{row.rank}</TableCell>
                    <TableCell className="px-2">
                      <TeamCell team={row} fallback={row.nameEn} />
                    </TableCell>
                    <TableCell className="px-2 text-center tabular-nums">{row.played}</TableCell>
                    <TableCell className="px-2 text-center tabular-nums">{row.won}</TableCell>
                    <TableCell className="px-2 text-center tabular-nums">{row.drawn}</TableCell>
                    <TableCell className="px-2 text-center tabular-nums">{row.lost}</TableCell>
                    <TableCell className="px-2 text-center tabular-nums">{row.goalsFor}</TableCell>
                    <TableCell className="px-2 text-center tabular-nums">{row.goalsAgainst}</TableCell>
                    <TableCell className="px-2 text-center tabular-nums">{row.goalDiff}</TableCell>
                    <TableCell className="px-2 text-center font-semibold tabular-nums">
                      {row.points}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
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
                  {match.localDate && <span>{match.localDate}</span>}
                  {match.stadium?.nameEn && (
                    <span>
                      {match.stadium.nameEn}
                      {match.stadium.city ? ` · ${match.stadium.city}` : ''}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function StatsSection({ stats, teams, stadiums }) {
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
              {stats.goals.highestScoringMatch.localDate &&
                ` · ${stats.goals.highestScoringMatch.localDate}`}
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
  const localDate = match.localDate?.trim();
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

function isMatchFinalized(match) {
  if (match.status === 'finished') return true;
  const finishedFlag = match.raw?.finished;
  return finishedFlag === 'TRUE' || finishedFlag === true || finishedFlag === 'true';
}

function sortMatchesForPartidos(matches = []) {
  const statusOrder = { finished: 0, live: 1, upcoming: 2 };
  return [...matches].sort((a, b) => {
    const statusDiff =
      (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3);
    if (statusDiff !== 0) return statusDiff;
    return new Date(b.kickoffAt || 0) - new Date(a.kickoffAt || 0);
  });
}

function hasScorers(rankings) {
  return rankings?.some((row) => row.points > 0);
}

export function GroupMatchesSection({
  matches,
  matchPredictionRankings = {},
  predictionGroup,
  simulationPredictionGroup,
  isAuthenticated = false,
}) {
  if (!matches?.length) {
    return (
      <p className="text-sm text-muted-foreground">No hay partidos de fase de grupos cargados.</p>
    );
  }

  const sortedMatches = sortMatchesForPartidos(matches);

  return (
    <div className="flex flex-col gap-3">
      {!isAuthenticated && (
        <p className="text-sm text-muted-foreground">
          <Link to="/login" className="text-foreground underline">
            Ingresá
          </Link>{' '}
          para ver quién sumó puntos en tu grupo en cada partido finalizado.
        </p>
      )}

      {sortedMatches.map((match) => {
        const rankings = matchPredictionRankings?.[match.externalId];
        const isFinished = isMatchFinalized(match);
        const showScorers =
          isAuthenticated && isFinished && hasScorers(rankings);
        const groupName = match.externalId?.startsWith('sim-')
          ? simulationPredictionGroup?.name
          : predictionGroup?.name;

        return (
          <div
            key={match.externalId}
            className="flex flex-col gap-2 rounded-lg border border-border/70 bg-card p-3"
          >
            <MatchScore match={match} />
            <div className="flex flex-wrap items-center gap-2 px-1 text-xs text-muted-foreground">
              {getMatchMetaParts(match).map((part) => (
                <span key={part}>{part}</span>
              ))}
            </div>

            {showScorers && (
              <MatchPredictionRankingsTable
                rankings={rankings}
                groupName={groupName}
                compact
              />
            )}
          </div>
        );
      })}
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
