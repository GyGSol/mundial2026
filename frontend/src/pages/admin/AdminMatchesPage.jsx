import { useCallback, useState } from 'react';
import { adminApi } from '../../api/adminClient.js';
import { useLiveData } from '../../hooks/useLiveData.js';
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
export default function AdminMatchesPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState('');

  const fetchMatches = useCallback(() => {
    const params = {};
    if (statusFilter) params.status = statusFilter;
    return adminApi.listMatches(params);
  }, [statusFilter]);

  const { data, loading, error, refresh } = useLiveData(fetchMatches, [statusFilter]);

  const matches = data?.matches ?? [];

  async function saveMatch(match, patch) {
    setBusyId(match.id);
    setMessage('');
    try {
      await adminApi.updateMatch(match.id, patch);
      setMessage('Partido actualizado');
      await refresh();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function recalculateOne(id) {
    setBusyId(id);
    setMessage('');
    try {
      await adminApi.recalculateMatch(id);
      setMessage('Puntos recalculados');
      await refresh();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function recalculateAll() {
    setBusyId('all');
    setMessage('');
    try {
      const result = await adminApi.recalculateAllMatches();
      setMessage(`Recalculados ${result.recalculated} partidos finalizados`);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Partidos</h2>
          <p className="text-sm text-slate-400">Editar marcadores y recalcular puntos.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={statusFilter || 'all'} onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-40 border-slate-700 bg-slate-950">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="upcoming">Próximos</SelectItem>
              <SelectItem value="live">En vivo</SelectItem>
              <SelectItem value="finished">Finalizados</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={recalculateAll} disabled={busyId === 'all'}>
            Recalcular todos (finished)
          </Button>
        </div>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {message ? <p className="text-sm text-amber-300">{message}</p> : null}
      {loading && !matches.length ? <p className="text-sm text-slate-400">Cargando…</p> : null}

      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-800 hover:bg-transparent">
              <TableHead>Equipos</TableHead>
              <TableHead>Grupo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Marcador</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {matches.map((match) => (
              <MatchRow
                key={match.id}
                match={match}
                busy={busyId === match.id}
                onSave={saveMatch}
                onRecalculate={recalculateOne}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function MatchRow({ match, busy, onSave, onRecalculate }) {
  const [homeScore, setHomeScore] = useState(String(match.homeScore ?? 0));
  const [awayScore, setAwayScore] = useState(String(match.awayScore ?? 0));
  const [status, setStatus] = useState(match.status);

  return (
    <TableRow className="border-slate-800">
      <TableCell className="text-sm">
        {match.homeTeamId} vs {match.awayTeamId}
        <p className="text-xs text-slate-500">{match.externalId}</p>
      </TableCell>
      <TableCell>{match.group || '—'}</TableCell>
      <TableCell>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
        >
          <option value="upcoming">upcoming</option>
          <option value="live">live</option>
          <option value="finished">finished</option>
        </select>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Input
            className="h-8 w-14 border-slate-700 bg-slate-950 tabular-nums"
            value={homeScore}
            onChange={(e) => setHomeScore(e.target.value)}
          />
          <span>-</span>
          <Input
            className="h-8 w-14 border-slate-700 bg-slate-950 tabular-nums"
            value={awayScore}
            onChange={(e) => setAwayScore(e.target.value)}
          />
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex flex-wrap justify-end gap-1">
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() =>
              onSave(match, {
                homeScore: Number(homeScore),
                awayScore: Number(awayScore),
                status,
              })
            }
          >
            Guardar
          </Button>
          {match.status === 'finished' || status === 'finished' ? (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => onRecalculate(match.id)}>
              Recalc
            </Button>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}
