import { useCallback, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { matchesApi, predictionsApi } from '../api/client.js';
import MatchCard from '../components/MatchCard.jsx';
import { Button } from '@/components/ui/button.jsx';
import { useLiveData } from '../hooks/useLiveData.js';
import { useAuth } from '../context/AuthContext.jsx';
import {
  canExportCalendarReminder,
  downloadBulkRemindersIcs,
} from '../lib/predictionCalendar.js';
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
  const { isAuthenticated } = useAuth();
  const [statusFilter, setStatusFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [message, setMessage] = useState('');

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
  const exportableReminderCount = useMemo(
    () => matches.filter(canExportCalendarReminder).length,
    [matches]
  );

  const handleBulkCalendar = () => {
    const count = downloadBulkRemindersIcs(matches);
    if (count > 0) {
      setMessage(`Descargado calendario con ${count} recordatorio(s). Abrilo en tu app de calendario.`);
      return;
    }
    setMessage('No hay partidos con recordatorio disponible en este momento.');
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Panel de predicciones</h1>
          <p className="text-sm text-muted-foreground">
            {matches.length} partidos
            {lastUpdated && ` · Actualizado ${formatLastUpdated(lastUpdated)} · tiempo real`}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
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

          {exportableReminderCount > 0 ? (
            <Button type="button" variant="outline" className="gap-2" onClick={handleBulkCalendar}>
              <Download className="size-4 shrink-0" aria-hidden />
              Recordatorios (.ics)
              <span className="text-muted-foreground">({exportableReminderCount})</span>
            </Button>
          ) : null}
        </div>
      </div>

      {message && <p className="text-sm text-foreground">{message}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading && !matches.length && (
        <p className="text-muted-foreground">Cargando partidos...</p>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {matches.map((match) => (
          <MatchCard
            key={match.id}
            match={match}
            onSave={handleSave}
            savingId={savingId}
          />
        ))}
      </div>
    </div>
  );
}
