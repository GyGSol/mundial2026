import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LineChart } from 'lucide-react';
import { buildPointsEvolutionFromRaw } from '../../../shared/leaderboardEvolution.js';
import { leaderboardApi } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { isSevereError } from '../lib/apiError.js';
import TechnicalDifficulties from '../components/TechnicalDifficulties.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import LeaderboardPointsEvolutionChart from '../components/charts/LeaderboardPointsEvolutionChart.jsx';
import PlayerChartLegend from '../components/charts/PlayerChartLegend.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';

function buildGroupOptions(groups) {
  return (groups ?? []).filter((group) => group.id !== '__nogroup' && !group.isVirtual);
}

export default function ChartsPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const myGroups = user?.competitionGroups ?? [];
  const groupOptions = useMemo(() => buildGroupOptions(myGroups), [myGroups]);

  const resolveDefaultGroupId = useCallback(
    (currentId) => {
      const fromQuery = searchParams.get('grupo');
      if (fromQuery && groupOptions.some((group) => group.id === fromQuery)) {
        return fromQuery;
      }
      if (currentId && groupOptions.some((group) => group.id === currentId)) {
        return currentId;
      }
      const preferredId = user?.competitionGroup?.id;
      if (preferredId && groupOptions.some((group) => group.id === preferredId)) {
        return preferredId;
      }
      return groupOptions[0]?.id ?? '';
    },
    [groupOptions, searchParams, user?.competitionGroup?.id]
  );

  const [selectedGroupId, setSelectedGroupId] = useState(() => resolveDefaultGroupId(''));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hiddenUserIds, setHiddenUserIds] = useState(() => new Set());
  const sessionCacheRef = useRef(new Map());

  const selectedGroup = useMemo(
    () => groupOptions.find((group) => group.id === selectedGroupId) ?? groupOptions[0],
    [groupOptions, selectedGroupId]
  );

  useEffect(() => {
    if (!groupOptions.length) return;
    setSelectedGroupId((current) => resolveDefaultGroupId(current));
  }, [groupOptions, resolveDefaultGroupId]);

  useEffect(() => {
    if (!selectedGroupId) return;
    const params = new URLSearchParams(searchParams);
    if (params.get('grupo') !== selectedGroupId) {
      params.set('grupo', selectedGroupId);
      setSearchParams(params, { replace: true });
    }
  }, [selectedGroupId, searchParams, setSearchParams]);

  useEffect(() => {
    if (!selectedGroupId) {
      setData(null);
      return undefined;
    }

    const cached = sessionCacheRef.current.get(selectedGroupId);
    if (cached) {
      setData(cached);
      setError(null);
      setLoading(false);
    } else {
      setLoading(true);
    }

    let cancelled = false;

    leaderboardApi
      .pointsEvolutionRaw(selectedGroupId)
      .then((raw) => buildPointsEvolutionFromRaw(raw))
      .then((payload) => {
        if (cancelled) return;
        sessionCacheRef.current.set(selectedGroupId, payload);
        setData(payload);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err);
        if (!cached) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedGroupId]);

  const handleGroupChange = (groupId) => {
    setSelectedGroupId(groupId);
    setHiddenUserIds(new Set());
  };

  const handleLegendToggle = (userId) => {
    setHiddenUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  if (!groupOptions.length) {
    return (
      <div className="w-full space-y-4">
        <h1 className="text-xl font-semibold tracking-tight">Gráficos</h1>
        <p className="text-sm text-muted-foreground">
          Todavía no participás en ningún grupo.{' '}
          <Link to="/groups" className="font-medium text-primary underline-offset-4 hover:underline">
            Creá uno o unite a un grupo existente
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <LineChart className="size-5 text-primary" aria-hidden />
            <h1 className="text-xl font-semibold tracking-tight">Gráficos</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Evolución de posiciones en la tabla por partido · {selectedGroup?.name ?? 'Grupo'}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <label htmlFor="charts-group-select" className="text-sm font-medium">
            Grupo
          </label>
          <Select value={selectedGroupId} onValueChange={handleGroupChange}>
            <SelectTrigger id="charts-group-select" className="w-full sm:w-[240px]">
              <SelectValue placeholder="Elegir grupo" />
            </SelectTrigger>
            <SelectContent>
              {groupOptions.map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  {group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      {error && isSevereError(error) ? <TechnicalDifficulties /> : null}
      {error && !isSevereError(error) ? (
        <p className="text-sm text-destructive">{error.message || 'No se pudo cargar el gráfico.'}</p>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Evolución de posiciones</CardTitle>
          <CardDescription>
            El eje horizontal marca el número de partido (0 = inicio); el vertical, el puesto en la
            tabla (1° arriba). En el tooltip ves el cruce. Tocá un jugador en la leyenda para
            mostrar u ocultar su línea.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-3 sm:p-6">
          {loading && !data ? <LoadingSpinner label="Cargando gráfico…" /> : null}
          {data ? (
            <>
              <LeaderboardPointsEvolutionChart
                checkpoints={data.checkpoints}
                series={data.series}
                hiddenUserIds={hiddenUserIds}
              />
              <PlayerChartLegend
                series={data.series}
                hiddenUserIds={hiddenUserIds}
                currentUserId={user?.id}
                onToggle={handleLegendToggle}
              />
            </>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to="/ranking">Volver al ranking</Link>
        </Button>
      </div>
    </div>
  );
}
