import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { competitionGroupsApi, leaderboardApi, matchesApi } from '../api/client.js';
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

function formatLastUpdated(date) {
  if (!date) return '';
  return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

export default function LeaderboardPage() {
  const { user, isAuthenticated } = useAuth();
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState('__all__');

  useEffect(() => {
    competitionGroupsApi
      .list()
      .then((data) => setGroups(data.groups ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (user?.competitionGroup?.id) setSelectedGroupId(user.competitionGroup.id);
  }, [user?.competitionGroup?.id]);

  const fetchLeaderboard = useCallback(async () => {
    const [leaderboardData, liveData] = await Promise.all([
      leaderboardApi.list(selectedGroupId === '__all__' ? '' : selectedGroupId),
      matchesApi.list({ status: 'live' }),
    ]);
    return {
      ...leaderboardData,
      liveMatches: liveData.matches ?? [],
    };
  }, [selectedGroupId]);

  const { data, loading, error, lastUpdated } = useLiveData(fetchLeaderboard, [selectedGroupId]);

  const activeGroup = data?.group || groups.find((g) => g.id === selectedGroupId);
  const isGeneralMode = selectedGroupId === '__all__' || !activeGroup;

  return (
    <div className="flex flex-col gap-6">
      {!loading && <LiveMatchesBar matches={data?.liveMatches ?? []} />}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {isGeneralMode ? 'Ranking general' : `Ranking · ${activeGroup.name}`}
          </h1>
          <p className="text-sm text-muted-foreground">
            {activeGroup
              ? `Grupo: ${activeGroup.name} · ranking independiente`
              : 'Tabla general de todos los jugadores'}
            {lastUpdated && ` · Actualizado ${formatLastUpdated(lastUpdated)}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {groups.length > 0 ? (
            <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Elegir grupo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">General (todos)</SelectItem>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Link to="/groups/new">
              <Button variant="outline" size="sm">
                Crear primer grupo
              </Button>
            </Link>
          )}
        </div>
      </div>

      {selectedGroupId === '__all__' && !loading && !isAuthenticated && (
        <p className="text-sm text-muted-foreground">
          También podés filtrar por grupo cuando inicies sesión o crear uno en{' '}
          <Link to="/groups/new" className="text-foreground underline">
            Crear grupo
          </Link>
          .
        </p>
      )}

      {loading && <p className="text-muted-foreground">Cargando ranking...</p>}
      {error && <p className="text-destructive">{error}</p>}

      <LeaderboardTable leaderboard={data?.leaderboard} />
    </div>
  );
}
