import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { matchesApi, predictionsApi } from '../api/client.js';
import MatchCard from '../components/MatchCard.jsx';
import PredictedGroupStandingsSection from '../components/PredictedGroupStandingsSection.jsx';
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

const views = [
  { id: 'matches', label: 'Partidos' },
  { id: 'standings', label: 'Mis tablas de grupos' },
];

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
    return matchesApi.list(params);
  }, [statusFilter, groupFilter]);

  const fetchGroupStandings = useCallback(() => {
    const params = {};
    if (groupFilter) params.group = groupFilter;
    return predictionsApi.groupStandings(params);
  }, [groupFilter]);

  const { data, loading, error, lastUpdated, refresh } = useLiveData(fetchMatches, [
    statusFilter,
    groupFilter,
  ]);

  const {
    data: standingsData,
    loading: standingsLoading,
    error: standingsError,
    lastUpdated: standingsLastUpdated,
    refresh: refreshStandings,
  } = useLiveData(fetchGroupStandings, [groupFilter], {
    enabled: isAuthenticated && activeView === 'standings',
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
      await Promise.all([refresh(), refreshStandings()]);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSavingId(null);
    }
  };

  const matches = data?.matches ?? [];
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
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {user?.email
              ? `Panel de predicciones del Jugador ${user.email}`
              : 'Panel de predicciones'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {activeView === 'matches'
              ? `${matches.length} partidos`
              : `${standingsGroups.length} grupos`}
            {updatedAt && ` · Actualizado ${formatLastUpdated(updatedAt)} · tiempo real`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeView === 'matches' ? (
            <ScheduleAllButton
              matches={matches}
              isScheduled={isScheduled}
              onScheduledMany={markManyScheduled}
            />
          ) : null}

          {activeView === 'matches' ? (
            <Select
              value={statusFilter || 'all'}
              onValueChange={(value) => setStatusFilter(value === 'all' ? '' : value)}
            >
              <SelectTrigger className="w-[180px]">
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
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Grupo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los grupos</SelectItem>
              {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'].map((g) => (
                <SelectItem key={g} value={g}>
                  Grupo {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {views.map((view) => (
          <Button
            key={view.id}
            size="sm"
            variant={activeView === view.id ? 'default' : 'outline'}
            className={cn(activeView !== view.id && 'text-muted-foreground')}
            onClick={() => setActiveView(view.id)}
          >
            {view.label}
          </Button>
        ))}
      </div>

      {activeView === 'matches' ? (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
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

      {message && <p className="text-sm text-foreground">{message}</p>}

      {activeView === 'matches' ? (
        <>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {loading && !matches.length && (
            <p className="text-muted-foreground">Cargando partidos...</p>
          )}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {matches.map((match) => (
              <div
                key={match.id}
                id={`match-${match.id}`}
                className={cn(
                  'scroll-mt-24 rounded-xl transition-shadow',
                  focusMatchId === match.id && 'ring-2 ring-primary ring-offset-2'
                )}
              >
                <MatchCard
                  match={match}
                  onSave={handleSave}
                  savingId={savingId}
                  isScheduled={isScheduled}
                  onScheduled={markScheduled}
                />
              </div>
            ))}
          </div>
        </>
      ) : !isAuthenticated ? (
        <p className="text-sm text-muted-foreground">Iniciá sesión para ver tus tablas de grupos.</p>
      ) : (
        <PredictedGroupStandingsSection
          groups={standingsGroups}
          loading={standingsLoading}
          error={standingsError}
        />
      )}
    </div>
  );
}
