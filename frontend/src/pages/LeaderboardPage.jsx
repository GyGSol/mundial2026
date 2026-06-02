import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { competitionGroupsApi, leaderboardApi, matchesApi } from '../api/client.js';
import TechnicalDifficulties from '../components/TechnicalDifficulties.jsx';
import { isSevereError } from '../lib/apiError.js';
import LeaderboardTable from '../components/LeaderboardTable.jsx';
import LiveMatchesBar from '../components/LiveMatchesBar.jsx';
import { useLiveData } from '../hooks/useLiveData.js';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';

function formatLastUpdated(date) {
  if (!date) return '';
  return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function isUserGroupAdmin(group) {
  return Boolean(group?.isAdmin) || group?.role === 'owner';
}

/** Opciones del ranking: un solo grupo por vista (sin modo general). */
function buildRankingGroupOptions(groups, { includeNoGroup = false } = {}) {
  const real = (groups ?? []).filter((g) => g.id !== '__nogroup' && !g.isVirtual);
  if (!includeNoGroup) return real;
  return [{ id: '__nogroup', name: 'Sin grupo' }, ...real];
}

export default function LeaderboardPage() {
  const { user, isAuthenticated } = useAuth();
  const [groups, setGroups] = useState([]);
  const [myGroups, setMyGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState('__nogroup');

  const canViewNoGroupRanking = useMemo(
    () => isAuthenticated && myGroups.some(isUserGroupAdmin),
    [isAuthenticated, myGroups]
  );

  const rankingGroupOptions = useMemo(
    () => buildRankingGroupOptions(groups, { includeNoGroup: canViewNoGroupRanking }),
    [groups, canViewNoGroupRanking]
  );

  const selectedGroup = useMemo(
    () => rankingGroupOptions.find((g) => g.id === selectedGroupId) ?? rankingGroupOptions[0],
    [rankingGroupOptions, selectedGroupId]
  );

  useEffect(() => {
    competitionGroupsApi
      .list()
      .then((data) => setGroups(data.groups ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setMyGroups([]);
      return;
    }
    competitionGroupsApi
      .my()
      .then((data) => setMyGroups(data.groups ?? []))
      .catch(() => setMyGroups([]));
  }, [isAuthenticated]);

  useEffect(() => {
    if (!rankingGroupOptions.length) return;

    setSelectedGroupId((current) => {
      if (rankingGroupOptions.some((g) => g.id === current)) return current;
      const preferredId = user?.competitionGroup?.id;
      if (preferredId && rankingGroupOptions.some((g) => g.id === preferredId)) {
        return preferredId;
      }
      return rankingGroupOptions[0].id;
    });
  }, [rankingGroupOptions, user?.competitionGroup?.id]);

  const effectiveGroupId =
    selectedGroup?.id ?? (canViewNoGroupRanking ? '__nogroup' : undefined);

  const fetchLeaderboard = useCallback(async () => {
    const [leaderboardData, liveData] = await Promise.all([
      leaderboardApi.list(effectiveGroupId),
      matchesApi.list({ status: 'live' }),
    ]);
    return {
      ...leaderboardData,
      liveMatches: liveData.matches ?? [],
    };
  }, [effectiveGroupId]);

  const { data, loading, error, lastUpdated } = useLiveData(fetchLeaderboard, [effectiveGroupId]);

  const displayGroup = data?.group || selectedGroup;
  const isNoGroupMode = effectiveGroupId === '__nogroup';
  const prizesWinnersCount = displayGroup?.prizesWinnersCount || 0;
  const groupPrizes = displayGroup?.prizes || [];
  const hasPrizes = !isNoGroupMode && prizesWinnersCount > 0;

  if (error && isSevereError(error)) {
    return (
      <TechnicalDifficulties
        error={error}
        title="No se pudo cargar la aplicación"
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {!loading && <LiveMatchesBar matches={data?.liveMatches ?? []} />}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Ranking · {displayGroup?.name ?? 'Sin grupo'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isNoGroupMode
              ? 'Solo jugadores que no participan en ningún grupo de competencia'
              : `Tabla del grupo ${displayGroup?.name}`}
            {lastUpdated && ` · Actualizado ${formatLastUpdated(lastUpdated)}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {rankingGroupOptions.length > 0 ? (
            <Select value={effectiveGroupId} onValueChange={setSelectedGroupId}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Elegir grupo" />
              </SelectTrigger>
              <SelectContent>
                {rankingGroupOptions.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Link to="/groups">
              <Button variant="outline" size="sm">
                Ver grupos
              </Button>
            </Link>
          )}
        </div>
      </div>

      {!loading && !isAuthenticated && (
        <p className="text-sm text-muted-foreground">
          Iniciá sesión para aparecer en el ranking si te unís a un grupo en{' '}
          <Link to="/groups" className="text-foreground underline">
            Grupos
          </Link>
          .
        </p>
      )}

      {loading && <p className="text-muted-foreground">Cargando ranking...</p>}
      {error && <p className="text-destructive">{error}</p>}

      {hasPrizes ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Premios del grupo</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1.5 text-sm">
              {groupPrizes.map((row) => (
                <li key={row.position} className="flex flex-wrap items-baseline gap-2">
                  <span className="font-medium tabular-nums">{row.position}°</span>
                  <span className="text-muted-foreground">
                    {row.prize?.trim() ? row.prize : 'Premio por definir'}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <LeaderboardTable
        leaderboard={data?.leaderboard}
        showGroupName={false}
        prizesWinnersCount={prizesWinnersCount}
      />
    </div>
  );
}
