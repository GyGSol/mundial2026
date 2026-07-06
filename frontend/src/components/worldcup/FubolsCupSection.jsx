import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { competitionGroupsApi } from '@/api/client.js';
import { useAuth } from '@/context/AuthContext.jsx';
import { useLiveData } from '@/hooks/useLiveData.js';
import { REALTIME_EVENTS } from '@/lib/realtimeSectors.js';
import LoadingSpinner from '@/components/LoadingSpinner.jsx';
import FubolCoinIcon from '@/components/FubolCoinIcon.jsx';
import FubolsCupBracket from '@/components/worldcup/FubolsCupBracket.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';
import { Card, CardContent } from '@/components/ui/card.jsx';

const STATUS_LABELS = {
  preview: 'Cruces proyectados',
  running: 'En curso',
  completed: 'Finalizada',
  cancelled: 'No disputada',
};

export default function FubolsCupSection() {
  const { user, isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();
  const myGroups = useMemo(
    () => (user?.competitionGroups ?? []).filter((g) => g.id !== '__nogroup' && !g.isVirtual),
    [user?.competitionGroups]
  );
  const [groupId, setGroupId] = useState('');

  useEffect(() => {
    const fromQuery = searchParams.get('groupId');
    if (fromQuery && myGroups.some((g) => g.id === fromQuery)) {
      setGroupId(fromQuery);
      return;
    }
    if (!groupId && myGroups[0]?.id) {
      setGroupId(myGroups[0].id);
    }
  }, [searchParams, myGroups, groupId]);

  const fetchCup = useCallback(
    () => (groupId ? competitionGroupsApi.fubolsCup.get(groupId) : Promise.resolve(null)),
    [groupId]
  );

  const { data, loading, error, refresh } = useLiveData(fetchCup, [groupId], {
    enabled: Boolean(groupId) && isAuthenticated,
    pollIntervalMs: 20_000,
    realtimeEvents: [REALTIME_EVENTS.MATCHES_UPDATED, REALTIME_EVENTS.LEADERBOARD_UPDATED],
    realtimeDebounceMs: 750,
  });

  if (!isAuthenticated) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Iniciá sesión para ver la Copa Fubols de tu grupo.
        </CardContent>
      </Card>
    );
  }

  if (!myGroups.length) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Unite a un grupo de competencia para participar en la Copa Fubols.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Copa Fubols</h2>
          <p className="text-sm text-muted-foreground">
            Playoff del top 8 jugadores del grupo: cuartos → semifinales → partido por el tercer puesto (dos cruces) y final.
          </p>
        </div>
        <Select value={groupId} onValueChange={setGroupId}>
          <SelectTrigger className="w-full sm:w-[240px]">
            <SelectValue placeholder="Elegir grupo" />
          </SelectTrigger>
          <SelectContent>
            {myGroups.map((group) => (
              <SelectItem key={group.id} value={group.id}>
                {group.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {data?.prizes ? (
        <p className="text-sm text-muted-foreground">
          Premio campeón: {data.prizes.championFubols} <FubolCoinIcon size="sm" /> ·{' '}
          {data.prizes.trophy} · +{data.prizes.roundAdvanceFubols}{' '}
          <FubolCoinIcon size="sm" /> por ronda ganada
        </p>
      ) : null}

      {loading && !data ? <LoadingSpinner label="Cargando Copa Fubols…" /> : null}
      {error ? (
        <p className="text-sm text-destructive">
          {error}{' '}
          <button type="button" className="underline" onClick={refresh}>
            Reintentar
          </button>
        </p>
      ) : null}

      {data ? (
        <>
          <p className="text-sm">
            Estado:{' '}
            <span className="font-medium">{STATUS_LABELS[data.tournament.status] ?? data.tournament.status}</span>
            {data.champion ? ` · Campeón: ${data.champion.name}` : null}
          </p>
          {data.tournament.status === 'preview' ? (
            <Card>
              <CardContent className="py-4 text-sm text-muted-foreground">
                Cruces proyectados — se fijan al terminar los dieciseisavos de final del Mundial.
              </CardContent>
            </Card>
          ) : null}
          {data.tournament.status === 'cancelled' ? (
            <Card>
              <CardContent className="py-6 text-center text-sm text-muted-foreground">
                Menos de 8 jugadores en el grupo: la Copa no se disputa.
              </CardContent>
            </Card>
          ) : (
            <>
              <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                <li>Los PB no suman en la Copa Fubols.</li>
                <li>Cada partido del cruce es individual (sin sumar entre partidos).</li>
                <li>Empate 1-1 en victorias: gana quien tuvo mayor diferencia en su partido ganado.</li>
                <li>Empate en puntos del partido en un cruce: gana quien tiene menor Gdif del torneo.</li>
                <li>Tocá un partido del cuadro para ir a Predicciones y cargar tu pronóstico.</li>
              </ul>
              <FubolsCupBracket rounds={data.rounds} demoDuel={data.demoDuel} />
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
