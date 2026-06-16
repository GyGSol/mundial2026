import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { leaderboardApi } from '../api/client.js';
import TechnicalDifficulties from '../components/TechnicalDifficulties.jsx';
import { isSevereError } from '../lib/apiError.js';
import LeaderboardTable from '../components/LeaderboardTable.jsx';
import { useLiveData } from '../hooks/useLiveData.js';
import { useAuth } from '../context/AuthContext.jsx';
import { shouldPollLeaderboardLive } from '../lib/leaderboardPolling.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';

const LiveMatchesBar = lazy(() => import('../components/LiveMatchesBar.jsx'));

const GROUP_POSITIONS_TABLE_ID = 'group-positions-table';

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
  const myGroups = user?.competitionGroups ?? [];
  const [selectedGroupId, setSelectedGroupId] = useState('');

  const canViewNoGroupRanking = useMemo(
    () => isAuthenticated && myGroups.some(isUserGroupAdmin),
    [isAuthenticated, myGroups]
  );

  const rankingGroupOptions = useMemo(
    () => buildRankingGroupOptions(myGroups, { includeNoGroup: canViewNoGroupRanking }),
    [myGroups, canViewNoGroupRanking]
  );

  const resolveDefaultGroupId = useCallback(
    (currentId) => {
      if (currentId && rankingGroupOptions.some((g) => g.id === currentId)) return currentId;
      const preferredId = user?.competitionGroup?.id;
      if (preferredId && rankingGroupOptions.some((g) => g.id === preferredId)) {
        return preferredId;
      }
      const firstRealGroup = rankingGroupOptions.find((g) => g.id !== '__nogroup');
      return firstRealGroup?.id ?? rankingGroupOptions[0]?.id ?? '';
    },
    [rankingGroupOptions, user?.competitionGroup?.id]
  );

  const selectedGroup = useMemo(
    () => rankingGroupOptions.find((g) => g.id === selectedGroupId) ?? rankingGroupOptions[0],
    [rankingGroupOptions, selectedGroupId]
  );

  useEffect(() => {
    if (!rankingGroupOptions.length) return;
    setSelectedGroupId((current) => resolveDefaultGroupId(current));
  }, [rankingGroupOptions, resolveDefaultGroupId]);

  const effectiveGroupId = useMemo(
    () => resolveDefaultGroupId(selectedGroupId),
    [resolveDefaultGroupId, selectedGroupId]
  );

  const canLoadRanking = Boolean(effectiveGroupId);

  const fetchLeaderboard = useCallback(
    () => leaderboardApi.dashboard(effectiveGroupId),
    [effectiveGroupId]
  );

  const { data, loading, error, lastUpdated } = useLiveData(fetchLeaderboard, [effectiveGroupId], {
    enabled: canLoadRanking,
    pollIntervalMs: 15000,
    pollWhen: shouldPollLeaderboardLive,
  });

  const dashboardMatchesGroup =
    Boolean(data) && String(data.group?.id ?? '') === String(effectiveGroupId);
  const dashboardLeaderboard = dashboardMatchesGroup ? data?.leaderboard : undefined;
  const dashboardKickoffBaseline = dashboardMatchesGroup
    ? data?.leaderboardKickoffBaseline
    : null;
  const hasLiveMatches = dashboardMatchesGroup && (data?.liveMatches?.length ?? 0) > 0;
  const rankingLoading = canLoadRanking && (loading || !dashboardMatchesGroup);
  const rankingReady = !canLoadRanking || (!loading && dashboardMatchesGroup);

  const displayGroup = dashboardMatchesGroup ? data?.group || selectedGroup : selectedGroup;
  const isNoGroupMode = effectiveGroupId === '__nogroup';
  const prizesWinnersCount = displayGroup?.prizesWinnersCount || 0;
  const groupPrizes = displayGroup?.prizes || [];
  const hasPrizes = !isNoGroupMode && prizesWinnersCount > 0;
  const showFubolPrizes = dashboardMatchesGroup && !isNoGroupMode && Boolean(data?.prizePool);
  const prizePoolTotal = data?.prizePool?.totalFubols ?? 0;

  const scrollToGroupStandings = useCallback(() => {
    document.getElementById(GROUP_POSITIONS_TABLE_ID)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }, []);

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
      {canLoadRanking ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full sm:w-fit"
          onClick={scrollToGroupStandings}
        >
          Ver Tabla de Posiciones del grupo {displayGroup?.name ?? 'Sin grupo'}
        </Button>
      ) : null}

      {rankingReady ? (
        <Suspense fallback={<LoadingSpinner label="Cargando partidos…" />}>
          <LiveMatchesBar
            matches={data?.liveMatches ?? []}
            finishedMatches={data?.recentFinishedMatches ?? []}
            nextMatches={data?.nextUpcomingMatches ?? []}
          />
        </Suspense>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0 flex flex-col gap-1">
          <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
            Ranking · {displayGroup?.name ?? 'Sin grupo'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isNoGroupMode
              ? 'Solo jugadores que no participan en ningún grupo de competencia'
              : `Tabla del grupo ${displayGroup?.name}`}
            {showFubolPrizes
              ? ` · Pozo ${prizePoolTotal} Fubols (50/30/20)`
              : null}
            {dashboardMatchesGroup && lastUpdated
              ? ` · Actualizado ${formatLastUpdated(lastUpdated)}`
              : null}
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          {rankingGroupOptions.length > 0 ? (
            <Select value={effectiveGroupId} onValueChange={setSelectedGroupId}>
              <SelectTrigger className="w-full sm:w-[220px]">
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

      {rankingReady && rankingGroupOptions.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Todavía no participás en ningún grupo.{' '}
          <Link to="/groups" className="text-foreground underline">
            Creá uno o unite a un grupo existente
          </Link>{' '}
          para ver su ranking.
        </p>
      )}

      {rankingLoading && <LoadingSpinner label="Cargando ranking…" />}
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

      {canLoadRanking ? (
        <section id={GROUP_POSITIONS_TABLE_ID} className="scroll-mt-24">
          <LeaderboardTable
            leaderboard={dashboardLeaderboard}
            leaderboardKickoffBaseline={dashboardKickoffBaseline}
            hasLiveMatches={hasLiveMatches}
            showGroupName={false}
            prizesWinnersCount={prizesWinnersCount}
            showFubolPrizes={showFubolPrizes}
          />
        </section>
      ) : null}
    </div>
  );
}
