import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { predictionsApi } from '../api/client.js';
import PredictionsMatchList from '../components/PredictionsMatchList.jsx';
import ScheduleAllButton from '../components/ScheduleAllButton.jsx';
import { useLiveData } from '../hooks/useLiveData.js';
import { useScheduledMatches } from '../hooks/useScheduledMatches.js';
import { useAuth } from '../context/AuthContext.jsx';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent } from '@/components/ui/card.jsx';
import LoadingSpinner from '@/components/LoadingSpinner.jsx';
import PushOptInBanner from '@/components/PushOptInBanner.jsx';
import { matchBarFeaturedIds, shouldPollPredictionsBar } from '../lib/predictionsBarPolling.js';

const LiveMatchesBar = lazy(() => import('../components/LiveMatchesBar.jsx'));

const PredictedGroupStandingsSection = lazy(
  () => import('../components/PredictedGroupStandingsSection.jsx')
);

const views = [
  { id: 'matches', label: 'Partidos' },
  { id: 'standings', label: 'Mis tablas de grupos' },
];

const GROUP_OPTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

function formatLastUpdated(date) {
  if (!date) return '';
  return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

export default function PredictionsPage() {
  const { user, isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();
  const focusMatchId = searchParams.get('match');
  const [activeView, setActiveView] = useState('matches');
  const [statusFilter, setStatusFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [message, setMessage] = useState('');
  const scrolledToMatch = useRef(false);
  const { isScheduled, markScheduled, markManyScheduled, unmarkScheduled } =
    useScheduledMatches();

  useEffect(() => {
    if (!focusMatchId) return;
    setStatusFilter('');
    setGroupFilter('');
    setActiveView('matches');
    scrolledToMatch.current = false;
  }, [focusMatchId]);

  const fetchMatches = useCallback(() => {
    const params = {};
    if (statusFilter) params.status = statusFilter;
    if (groupFilter) params.group = groupFilter;
    return predictionsApi.listMatches(params);
  }, [statusFilter, groupFilter]);

  const fetchGroupStandings = useCallback(() => {
    const params = {};
    if (groupFilter) params.group = groupFilter;
    return predictionsApi.groupStandings(params);
  }, [groupFilter]);

  const { data, loading, error, lastUpdated, refresh } = useLiveData(fetchMatches, [
    statusFilter,
    groupFilter,
  ], {
    pollIntervalMs: 15000,
    pollWhen: shouldPollPredictionsBar,
  });

  const {
    data: standingsData,
    loading: standingsLoading,
    error: standingsError,
    lastUpdated: standingsLastUpdated,
    refresh: refreshStandings,
  } = useLiveData(fetchGroupStandings, [groupFilter], {
    enabled: isAuthenticated && activeView === 'standings',
    pollIntervalMs: 15000,
    pollWhen: (payload) =>
      (payload?.groups ?? []).some((group) => (group.liveTeamIds?.length ?? 0) > 0),
  });

  const handleSave = async (matchId, homeGoals, awayGoals) => {
    if (!isAuthenticated) {
      setMessage('Iniciá sesión para guardar predicciones');
      return;
    }

    setSavingId(matchId);
    setMessage('');
    try {
      await predictionsApi.save(matchId, homeGoals, awayGoals);
      unmarkScheduled(matchId);
      setMessage('Predicción guardada');
      const refreshTasks = [refresh()];
      if (activeView === 'standings') {
        refreshTasks.push(refreshStandings());
      }
      await Promise.all(refreshTasks);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSavingId(null);
    }
  };

  const handleGroupSelect = (group) => {
    setGroupFilter(group);
    setStatusFilter('');
    setActiveView('matches');
    setMessage(`Mostrando partidos del grupo ${group}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const matches = data?.matches ?? [];
  const barLiveMatches = data?.liveMatches ?? [];
  const barRecentFinishedMatches = data?.recentFinishedMatches ?? [];
  const barFeaturedIds = matchBarFeaturedIds({
    liveMatches: barLiveMatches,
    recentFinishedMatches: barRecentFinishedMatches,
  });
  const standingsGroups = standingsData?.groups ?? [];
  const updatedAt = activeView === 'standings' ? standingsLastUpdated : lastUpdated;

  useEffect(() => {
    if (!focusMatchId || loading || scrolledToMatch.current || activeView !== 'matches') return;
    const el = document.getElementById(`match-${focusMatchId}`);
    if (!el) return;
    scrolledToMatch.current = true;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focusMatchId, loading, matches, activeView]);

  return (
    <div
      className={cn(
        'flex flex-col gap-4 sm:gap-6',
        activeView === 'matches' && 'pb-[calc(8.5rem+env(safe-area-inset-bottom))]'
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0 flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {user?.email ? 'Mis predicciones' : 'Panel de predicciones'}
          </h1>
          {user?.email ? (
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            {activeView === 'matches'
              ? `${matches.length} partido${matches.length === 1 ? '' : 's'}`
              : `${standingsGroups.length} grupo${standingsGroups.length === 1 ? '' : 's'}`}
            {groupFilter ? ` · Grupo ${groupFilter}` : ''}
            {updatedAt && ` · Actualizado ${formatLastUpdated(updatedAt)}`}
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
          <Button variant="outline" size="sm" asChild className="gap-1.5 border-violet-500/30">
            <Link to="/ai-predictions">
              <Sparkles className="size-4" aria-hidden />
              Predicciones IA
            </Link>
          </Button>
          {activeView === 'matches' ? (
            <ScheduleAllButton matches={matches} onScheduledMany={markManyScheduled} />
          ) : null}

          {activeView === 'matches' ? (
            <Select
              value={statusFilter || 'all'}
              onValueChange={(value) => setStatusFilter(value === 'all' ? '' : value)}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="upcoming">Próximos</SelectItem>
                <SelectItem value="live">En vivo</SelectItem>
                <SelectItem value="finished">Finalizados</SelectItem>
              </SelectContent>
            </Select>
          ) : null}

          <Select
            value={groupFilter || 'all'}
            onValueChange={(value) => setGroupFilter(value === 'all' ? '' : value)}
          >
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Grupo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los grupos</SelectItem>
              {GROUP_OPTIONS.map((g) => (
                <SelectItem key={g} value={g}>
                  Grupo {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {views.map((view) => (
          <Button
            key={view.id}
            size="sm"
            variant={activeView === view.id ? 'default' : 'outline'}
            className={cn('shrink-0', activeView !== view.id && 'text-muted-foreground')}
            onClick={() => setActiveView(view.id)}
          >
            {view.label}
          </Button>
        ))}
      </div>

      {activeView === 'matches' ? (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-foreground">
              Consultá el estado de los jugadores antes de predecir
            </p>
            <Link
              to="/mundial?tab=players"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              Enciclopedia de Jugadores
              <Badge className="border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300">
                Beta
              </Badge>
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {activeView === 'matches' && isAuthenticated ? (
        <PushOptInBanner enabled={isAuthenticated} />
      ) : null}

      {message && <p className="text-sm text-foreground">{message}</p>}

      {activeView === 'matches' ? (
        <>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {loading && !matches.length && (
            <LoadingSpinner label="Cargando partidos…" />
          )}

          {!loading && !matches.length && !error ? (
            <p className="text-sm text-muted-foreground">
              No hay partidos con los filtros actuales.
              {groupFilter ? (
                <>
                  {' '}
                  <button
                    type="button"
                    className="font-medium text-primary underline"
                    onClick={() => setGroupFilter('')}
                  >
                    Ver todos los grupos
                  </button>
                </>
              ) : null}
            </p>
          ) : null}

          {!loading && (barLiveMatches.length > 0 || barRecentFinishedMatches.length > 0) ? (
            <Suspense fallback={<LoadingSpinner label="Cargando partidos…" />}>
              <LiveMatchesBar
                matches={barLiveMatches}
                recentFinishedMatches={barRecentFinishedMatches}
              />
            </Suspense>
          ) : null}

          <PredictionsMatchList
            matches={matches}
            excludeMatchIds={barFeaturedIds}
            focusMatchId={focusMatchId}
            onSave={handleSave}
            savingId={savingId}
            isScheduled={isScheduled}
            onScheduled={markScheduled}
            expandFinished={statusFilter === 'finished'}
          />
        </>
      ) : !isAuthenticated ? (
        <p className="text-sm text-muted-foreground">Iniciá sesión para ver tus tablas de grupos.</p>
      ) : (
        <Suspense fallback={<LoadingSpinner label="Cargando tablas de grupos…" />}>
          <PredictedGroupStandingsSection
            groups={standingsGroups}
            knockout={standingsData?.knockout}
            thirdPlaceStandings={standingsData?.thirdPlaceStandings}
            teams={standingsData?.teams}
            loading={standingsLoading}
            error={standingsError}
            onGroupSelect={handleGroupSelect}
          />
        </Suspense>
      )}
    </div>
  );
}
