import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { playersApi, teamsApi } from '../../api/client.js';
import { useLiveData } from '../../hooks/useLiveData.js';
import { REALTIME_EVENTS } from '../../lib/realtimeSectors.js';
import PlayerDetailDialog from '../PlayerDetailDialog.jsx';
import { getTeamFlag } from '../../lib/teamMeta.js';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import LoadingSpinner from '@/components/LoadingSpinner.jsx';
import { Input } from '@/components/ui/input.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table.jsx';
import { cn } from '@/lib/utils';
import { ClubCell } from '../ClubDisplay.jsx';
import PlayerAvatar from '../PlayerAvatar.jsx';
import { formatKm, formatStatValue, hasPlayerStats, totalSeasonGoals } from '../../lib/playerStats.js';

const POSITIONS = [
  { value: 'GK', label: 'Portero' },
  { value: 'DEF', label: 'Defensa' },
  { value: 'MID', label: 'Mediocampista' },
  { value: 'FWD', label: 'Delantero' },
];

const STATUS_FILTERS = [
  { value: 'priority', label: 'Alertas primero' },
  { value: 'alert', label: 'Solo lesiones y dudas' },
  { value: 'injured', label: 'Lesionado' },
  { value: 'doubt', label: 'Duda' },
  { value: 'available', label: 'Disponible' },
  { value: 'all', label: 'Todos (A-Z)' },
];

function healthBadgeClass(status) {
  if (status === 'injured') return 'border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400';
  if (status === 'doubt') return 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400';
  if (status === 'unknown') return 'border-border bg-muted/40 text-muted-foreground';
  return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
}

export default function PlayersSection() {
  const [teamFilter, setTeamFilter] = useState('');
  const [positionFilter, setPositionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('priority');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [teams, setTeams] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState('');

  useEffect(() => {
    teamsApi.list().then((data) => setTeams(data.teams ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const fetchPlayers = useCallback(() => {
    const params = { page, limit: 24 };
    if (teamFilter) params.team = teamFilter;
    if (positionFilter) params.position = positionFilter;
    if (searchQuery) params.q = searchQuery;
    if (statusFilter) params.status = statusFilter;
    return playersApi.list(params);
  }, [page, teamFilter, positionFilter, statusFilter, searchQuery]);

  const { data, loading, error, lastUpdated, refresh } = useLiveData(fetchPlayers, [
    page,
    teamFilter,
    positionFilter,
    statusFilter,
    searchQuery,
  ], {
    realtimeEvents: [REALTIME_EVENTS.PLAYERS_UPDATED],
    realtimeDebounceMs: 750,
  });

  const players = data?.players ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const aiAvailable = data?.aiAvailable !== false;

  const refreshTeamIntel = useCallback(
    async ({ force = false } = {}) => {
      if (!teamFilter || refreshing) return;
      setRefreshing(true);
      setRefreshMessage('');
      try {
        const result = await playersApi.refreshTeamIntel(teamFilter, { force });
        setRefreshMessage(
          result.message ??
            `IA actualizó ${result.updated} jugador${result.updated === 1 ? '' : 'es'} de ${result.teamName ?? result.team}${
              result.performanceFetched
                ? ` · stats ${result.performanceFetched} jugador${result.performanceFetched === 1 ? '' : 'es'}`
                : ''
            }`
        );
        await refresh();
      } catch (err) {
        setRefreshMessage(err.message);
      } finally {
        setRefreshing(false);
      }
    },
    [teamFilter, refreshing, refresh]
  );

  useEffect(() => {
    if (!teamFilter || !aiAvailable || refreshing) return;
    const needsIntel = players.length > 0 && players.every((p) => p.healthStatus === 'unknown');
    if (needsIntel) {
      refreshTeamIntel();
    }
  }, [teamFilter, aiAvailable, players, refreshing, refreshTeamIntel]);

  const openDetail = (id) => {
    setSelectedPlayerId(id);
    setDetailOpen(true);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">Enciclopedia de Jugadores</h2>
          <Badge className="gap-1 border-violet-500/40 bg-violet-500/10 text-violet-200">
            <Sparkles className="size-3" aria-hidden />
            IA
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Planteles locales del mundial con lesiones, tarjetas, forma reciente y estadísticas del año
          (goles, PJ, minutos club/selección) consultadas por IA.
          {lastUpdated
            ? ` · Actualizado ${lastUpdated.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`
            : ''}
          {total > 0 ? ` · ${total} jugadores` : ''}
        </p>
        {!aiAvailable ? (
          <p className="text-sm text-amber-200">La IA no está configurada en el servidor.</p>
        ) : null}
        {refreshMessage ? (
          <p className="text-sm text-muted-foreground">{refreshMessage}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="max-w-xs"
          placeholder="Buscar por nombre..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <Select
          value={teamFilter || 'all'}
          onValueChange={(v) => {
            setTeamFilter(v === 'all' ? '' : v);
            setPage(1);
            setRefreshMessage('');
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Selección" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las selecciones</SelectItem>
            {teams.map((t) => (
              <SelectItem key={t.externalId} value={t.fifaCode || t.externalId}>
                {t.nameEn}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={positionFilter || 'all'}
          onValueChange={(v) => {
            setPositionFilter(v === 'all' ? '' : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Posición" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las posiciones</SelectItem>
            {POSITIONS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!teamFilter || !aiAvailable || refreshing}
          onClick={() => refreshTeamIntel({ force: true })}
          className="gap-1.5 border-violet-500/30"
        >
          {refreshing ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="size-4" aria-hidden />
          )}
          Consultar IA
        </Button>
      </div>

      {!teamFilter ? (
        <p className="text-sm text-muted-foreground">
          Elegí una selección para que la IA analice lesiones, tarjetas y estado físico del plantel.
        </p>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading && !players.length ? (
        <LoadingSpinner variant="compact" label="Cargando jugadores…" />
      ) : null}

      {!loading && !players.length ? (
        <p className="text-sm text-muted-foreground">No hay jugadores para los filtros elegidos.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Jugador</TableHead>
                <TableHead>Selección</TableHead>
                <TableHead>Posición</TableHead>
                <TableHead>Club</TableHead>
                <TableHead>Edad</TableHead>
                <TableHead className="text-right">G</TableHead>
                <TableHead className="text-right">Min</TableHead>
                <TableHead className="text-right">PJ</TableHead>
                <TableHead className="text-right">Km</TableHead>
                <TableHead>Tarjetas</TableHead>
                <TableHead>Estado IA</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {players.map((player) => {
                const flag = getTeamFlag({ fifaCode: player.fifaCode, flag: player.flag });
                const cards =
                  player.yellowCards != null || player.redCards != null
                    ? `${player.yellowCards ?? 0}A / ${player.redCards ?? 0}R`
                    : '—';
                const stats = player.stats;
                const showStats = hasPlayerStats(stats);
                return (
                  <TableRow
                    key={player.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openDetail(player.id)}
                  >
                    <TableCell className="font-medium">
                      <span className="inline-flex items-center gap-2">
                        <PlayerAvatar
                          name={player.fullName}
                          photoUrl={player.photoUrl}
                          size="sm"
                          variant="portrait"
                          className="max-h-10 max-w-[2.25rem] rounded-md border border-border bg-white"
                        />
                        {player.fullName}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-2">
                        {flag ? (
                          <img src={flag} alt="" className="size-5 rounded-sm object-cover" />
                        ) : null}
                        {player.teamName || player.fifaCode}
                      </span>
                    </TableCell>
                    <TableCell>{player.positionLabel}</TableCell>
                    <TableCell>
                      <ClubCell
                        club={player.currentClub}
                        clubCrestUrl={player.clubCrestUrl}
                        leagueEmblemUrl={player.leagueEmblemUrl}
                        leagueName={player.leagueName}
                      />
                    </TableCell>
                    <TableCell>{player.age ?? '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {showStats ? totalSeasonGoals(stats) : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {showStats ? formatStatValue(stats.acumuladoTemporada?.minutos, 0) : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {showStats ? formatStatValue(stats.acumuladoTemporada?.PJ, 0) : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {showStats && stats.acumuladoTemporada?.kmPromedioPartido != null
                        ? formatKm(stats.acumuladoTemporada.kmPromedioPartido)
                        : '—'}
                    </TableCell>
                    <TableCell className="tabular-nums">{cards}</TableCell>
                    <TableCell>
                      <span className="inline-flex flex-wrap gap-1">
                        <Badge className={cn(healthBadgeClass(player.healthStatus))}>
                          {player.healthLabel}
                        </Badge>
                        {player.suspended ? <Badge variant="destructive">Suspendido</Badge> : null}
                        {player.isStarter ? <Badge variant="default">Titular</Badge> : null}
                        {player.intelStale ? (
                          <Badge variant="outline" className="text-[10px]">
                            Sin IA
                          </Badge>
                        ) : null}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {totalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            Página {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      ) : null}

      <PlayerDetailDialog
        playerId={selectedPlayerId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onIntelUpdated={refresh}
      />
    </div>
  );
}
