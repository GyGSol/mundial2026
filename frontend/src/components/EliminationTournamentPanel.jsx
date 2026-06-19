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
  const match = currentMatchTable?.match;
  const leaderboard = currentMatchTable?.leaderboard ?? [];

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

      {match ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">
            {match.homeTeam?.name ?? 'Local'} vs {match.awayTeam?.name ?? 'Visitante'}
            {match.status === 'live' ? (
              <span className="ml-2 text-xs font-normal text-emerald-600">En vivo</span>
            ) : null}
            {match.homeScore != null && match.awayScore != null
              ? ` · ${match.homeScore}-${match.awayScore}`
              : null}
          </p>
          <LeaderboardTable
            leaderboard={leaderboard}
            showGroupName={false}
            prizesWinnersCount={0}
            hasLiveMatches={match.status === 'live'}
          />
        </div>
      ) : status === 'running' ? (
        <p className="text-sm text-muted-foreground">
          Esperando el próximo partido finalizado para actualizar la tabla de eliminación.
        </p>
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
