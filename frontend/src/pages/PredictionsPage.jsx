import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { matchesApi, predictionsApi } from '../api/client.js';
import MatchCard from '../components/MatchCard.jsx';
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

function formatLastUpdated(date) {
  if (!date) return '';
  return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

export default function PredictionsPage() {
  const { user, isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();
  const focusMatchId = searchParams.get('match');
  const [statusFilter, setStatusFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [message, setMessage] = useState('');
  const scrolledToMatch = useRef(false);
  const { isScheduled, markScheduled, markManyScheduled } = useScheduledMatches();

  useEffect(() => {
    if (!focusMatchId) return;
    setStatusFilter('');
    setGroupFilter('');
    scrolledToMatch.current = false;
  }, [focusMatchId]);

  const fetchMatches = useCallback(() => {
    const params = {};
    if (statusFilter) params.status = statusFilter;
    if (groupFilter) params.group = groupFilter;
    return matchesApi.list(params);
  }, [statusFilter, groupFilter]);

  const { data, loading, error, lastUpdated, refresh } = useLiveData(fetchMatches, [
    statusFilter,
    groupFilter,
  ]);

  const handleSave = async (matchId, homeGoals, awayGoals) => {
    if (!isAuthenticated) {
      setMessage('Iniciá sesión para guardar predicciones');
      return;
    }

    setSavingId(matchId);
    setMessage('');
    try {
      await predictionsApi.save(matchId, homeGoals, awayGoals);
      setMessage('Predicción guardada');
      await refresh();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSavingId(null);
    }
  };

  const matches = data?.matches ?? [];

  useEffect(() => {
    if (!focusMatchId || loading || scrolledToMatch.current) return;
    const el = document.getElementById(`match-${focusMatchId}`);
    if (!el) return;
    scrolledToMatch.current = true;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focusMatchId, loading, matches]);

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
            {matches.length} partidos
            {lastUpdated && ` · Actualizado ${formatLastUpdated(lastUpdated)} · tiempo real`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ScheduleAllButton
            matches={matches}
            isScheduled={isScheduled}
            onScheduledMany={markManyScheduled}
          />
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

      {message && <p className="text-sm text-foreground">{message}</p>}
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
    </div>
  );
}
