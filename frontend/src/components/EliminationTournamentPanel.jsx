import { Link } from 'react-router-dom';
import LeaderboardTable from './LeaderboardTable.jsx';
import LoadingSpinner from './LoadingSpinner.jsx';
import FubolCoinIcon from './FubolCoinIcon.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent } from '@/components/ui/card.jsx';

const STATUS_LABELS = {
  inactive: 'Sin activar',
  open: 'Inscripciones abiertas',
  running: 'En curso',
  completed: 'Finalizado',
};

function formatMatchLine(match) {
  const home = match.homeTeam?.name ?? match.homeTeam?.nameEn ?? 'Local';
  const away = match.awayTeam?.name ?? match.awayTeam?.nameEn ?? 'Visitante';
  const score =
    match.homeScore != null && match.awayScore != null
      ? ` · ${match.homeScore}-${match.awayScore}`
      : '';
  return `${home} vs ${away}${score}`;
}

export default function EliminationTournamentPanel({
  data,
  loading,
  error,
  isAuthenticated,
  onRetry,
}) {
  if (loading) {
    return <LoadingSpinner label="Cargando Torneo Eliminación…" />;
  }

  if (error) {
    return (
      <p className="text-sm text-destructive">
        {error}{' '}
        {onRetry ? (
          <button type="button" className="underline" onClick={onRetry}>
            Reintentar
          </button>
        ) : null}
      </p>
    );
  }

  if (!data) return null;

  const { tournament, currentMatchTable, activePlayers, eliminated, champion, prizeFubols } =
    data;
  const status = tournament?.status ?? 'inactive';
  const matches =
    currentMatchTable?.matches?.length > 0
      ? currentMatchTable.matches
      : currentMatchTable?.match
        ? [currentMatchTable.match]
        : [];
  const leaderboard = currentMatchTable?.leaderboard ?? [];
  const roundMode = currentMatchTable?.mode;
  const hasLive = matches.some((m) => m.status === 'live');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 text-sm text-muted-foreground">
        <p>
          Estado: <span className="font-medium text-foreground">{STATUS_LABELS[status]}</span>
          {status === 'open' ? ` · ${tournament.enrolledCount} inscriptos` : null}
          {status === 'running' || status === 'completed'
            ? ` · ${activePlayers.length} activos`
            : null}
          {status === 'completed' && champion
            ? ` · Campeón: ${champion.name}`
            : null}
        </p>
        <p className="inline-flex flex-wrap items-center gap-1">
          Premio: {prizeFubols} <FubolCoinIcon size="sm" />
          {data.poolTotalFubols > 0 ? ` · Pozo ${data.poolTotalFubols} Fubols` : null}
        </p>
      </div>

      {status === 'inactive' ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            El administrador del grupo debe activar el Torneo Eliminación desde{' '}
            <Link to="/groups" className="text-primary underline">
              Grupos
            </Link>
            .
          </CardContent>
        </Card>
      ) : null}

      {status === 'open' && !data.isEnrolled && isAuthenticated ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center text-sm">
            <p className="text-muted-foreground">
              Inscribite desde Grupos para participar cuando el admin inicie el torneo.
            </p>
            <Button asChild size="sm" variant="outline">
              <Link to="/groups">Ir a Grupos</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {status === 'running' && matches.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">
            {roundMode === 'preview' ? 'Próximo' : hasLive ? 'En juego' : 'Ronda actual'}
            {matches.length > 1 ? ` · ${matches.length} partidos` : null}
          </p>
          <ul className="flex flex-col gap-1 text-sm">
            {matches.map((match) => (
              <li key={match.id ?? match.externalId}>
                {formatMatchLine(match)}
                {match.status === 'live' ? (
                  <span className="ml-2 text-xs font-normal text-emerald-600">En vivo</span>
                ) : null}
              </li>
            ))}
          </ul>
          {roundMode === 'preview' ? (
            <p className="text-xs text-muted-foreground">
              Puntos en cero hasta que arranquen. La tabla se ordena por Gdif (menor error arriba).
            </p>
          ) : null}
          {leaderboard.length > 0 ? (
            <LeaderboardTable
              leaderboard={leaderboard}
              showGroupName={false}
              prizesWinnersCount={0}
              hasLiveMatches={hasLive}
            />
          ) : null}
        </div>
      ) : status === 'running' ? (
        <p className="text-sm text-muted-foreground">
          No hay partidos programados por ahora. La tabla se actualizará con el próximo encuentro.
        </p>
      ) : null}

      {status === 'completed' && matches.length > 0 && leaderboard.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Última ronda</p>
          <ul className="flex flex-col gap-1 text-sm">
            {matches.map((match) => (
              <li key={match.id ?? match.externalId}>{formatMatchLine(match)}</li>
            ))}
          </ul>
          <LeaderboardTable
            leaderboard={leaderboard}
            showGroupName={false}
            prizesWinnersCount={0}
            hasLiveMatches={false}
          />
        </div>
      ) : null}

      {eliminated.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Eliminados</p>
          <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
            {eliminated.map((row) => (
              <li key={`${row.userId}-${row.matchId}`}>
                {row.name}
                {row.isAiUser ? ' (IA)' : ''} — {row.matchLabel || 'Partido'} (#{row.rankInMatch})
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {status === 'completed' && champion ? (
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-lg font-semibold">Campeón: {champion.name}</p>
            <p className="mt-1 inline-flex items-center justify-center gap-1 text-sm text-muted-foreground">
              Premio {prizeFubols} <FubolCoinIcon size="sm" />
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
