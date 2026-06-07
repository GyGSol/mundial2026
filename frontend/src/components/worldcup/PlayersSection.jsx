import { useCallback, useEffect, useState } from 'react';
import { playersApi, teamsApi } from '../../api/client.js';
import { useLiveData } from '../../hooks/useLiveData.js';
import PlayerDetailDialog from '../PlayerDetailDialog.jsx';
import { getTeamFlag } from '../../lib/teamMeta.js';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
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

const POSITIONS = [
  { value: 'GK', label: 'Portero' },
  { value: 'DEF', label: 'Defensa' },
  { value: 'MID', label: 'Mediocampista' },
  { value: 'FWD', label: 'Delantero' },
];

function healthBadgeClass(status) {
  if (status === 'injured') return 'border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400';
  if (status === 'doubt') return 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400';
  return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
}

export default function PlayersSection() {
  const [teamFilter, setTeamFilter] = useState('');
  const [positionFilter, setPositionFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [teams, setTeams] = useState([]);

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
    return playersApi.list(params);
  }, [page, teamFilter, positionFilter, searchQuery]);

  const { data, loading, error, lastUpdated } = useLiveData(fetchPlayers, [
    page,
    teamFilter,
    positionFilter,
    searchQuery,
  ]);

  const players = data?.players ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const openDetail = (id) => {
    setSelectedPlayerId(id);
    setDetailOpen(true);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">Enciclopedia de Jugadores</h2>
          <Badge className="border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300">
            Beta
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Consultá planteles, lesiones y titulares en vivo antes de predecir.
          {lastUpdated
            ? ` · Actualizado ${lastUpdated.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`
            : ''}
          {total > 0 ? ` · ${total} jugadores` : ''}
        </p>
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
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading && !players.length ? (
        <p className="text-sm text-muted-foreground">Cargando jugadores...</p>
      ) : null}

      {!loading && !players.length ? (
        <p className="text-sm text-muted-foreground">
          No hay jugadores cargados. Ejecutá <code className="text-xs">npm run sync:players</code> en el
          servidor.
        </p>
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
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {players.map((player) => {
                const flag = getTeamFlag({ fifaCode: player.fifaCode, flag: player.flag });
                return (
                  <TableRow
                    key={player.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openDetail(player.id)}
                  >
                    <TableCell className="font-medium">{player.fullName}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-2">
                        {flag ? (
                          <img src={flag} alt="" className="size-5 rounded-sm object-cover" />
                        ) : null}
                        {player.teamName || player.fifaCode}
                      </span>
                    </TableCell>
                    <TableCell>{player.positionLabel}</TableCell>
                    <TableCell className="text-muted-foreground">{player.currentClub || '—'}</TableCell>
                    <TableCell>{player.age ?? '—'}</TableCell>
                    <TableCell>
                      <span className="inline-flex flex-wrap gap-1">
                        <Badge className={cn(healthBadgeClass(player.healthStatus))}>
                          {player.healthLabel}
                        </Badge>
                        {player.isStarter ? <Badge variant="default">Titular</Badge> : null}
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
      />
    </div>
  );
}
