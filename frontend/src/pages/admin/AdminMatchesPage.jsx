import { useCallback, useState } from 'react';
import { adminApi } from '../../api/adminClient.js';
import { useLiveData } from '../../hooks/useLiveData.js';
import AdminCard from '../../components/admin/AdminCard.jsx';
import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx';
import { adminInput, adminMuted, adminPage, adminTableWrap } from '../../components/admin/adminTheme.js';
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
    <div className={adminPage}>
      <AdminPageHeader
        title="Partidos"
        description="Editar marcadores, estado, grupo, jornada y fecha."
      >
        <Select value={statusFilter || 'all'} onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className={`w-40 ${adminInput}`}>
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
      </AdminPageHeader>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {message ? <p className="text-sm text-amber-300">{message}</p> : null}
      {loading && !matches.length ? <p className={adminMuted}>Cargando…</p> : null}

      <AdminCard accent flush contentClassName="p-0">
        <div className={adminTableWrap}>
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
      </AdminCard>
    </div>
  );
}

function MatchRow({ match, busy, onSave, onRecalculate }) {
  const [homeScore, setHomeScore] = useState(String(match.homeScore ?? 0));
  const [awayScore, setAwayScore] = useState(String(match.awayScore ?? 0));
  const [status, setStatus] = useState(match.status);
  const [group, setGroup] = useState(match.group ?? '');
  const [matchday, setMatchday] = useState(match.matchday ?? '');
  const [kickoffAt, setKickoffAt] = useState(
    match.kickoffAt ? new Date(match.kickoffAt).toISOString().slice(0, 16) : ''
  );

  return (
    <TableRow className="border-slate-800">
      <TableCell className="text-sm">
        {match.homeTeamId} vs {match.awayTeamId}
        <p className="text-xs text-slate-500">{match.externalId}</p>
        <Input
          className={`mt-1 h-7 text-xs ${adminInput}`}
          placeholder="Fecha (ISO local)"
          type="datetime-local"
          value={kickoffAt}
          onChange={(e) => setKickoffAt(e.target.value)}
        />
      </TableCell>
      <TableCell>
        <Input
          className={`mb-1 h-8 w-16 text-sm ${adminInput}`}
          placeholder="Grupo"
          value={group}
          onChange={(e) => setGroup(e.target.value)}
        />
        <Input
          className={`h-8 w-20 text-xs ${adminInput}`}
          placeholder="Jornada"
          value={matchday}
          onChange={(e) => setMatchday(e.target.value)}
        />
      </TableCell>
      <TableCell>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className={`rounded border px-2 py-1 text-sm ${adminInput}`}
        >
          <option value="upcoming">upcoming</option>
          <option value="live">live</option>
          <option value="finished">finished</option>
        </select>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Input
            className={`h-8 w-14 tabular-nums ${adminInput}`}
            value={homeScore}
            onChange={(e) => setHomeScore(e.target.value)}
          />
          <span>-</span>
          <Input
            className={`h-8 w-14 tabular-nums ${adminInput}`}
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
                group: group.trim() || null,
                matchday: matchday.trim() || null,
                kickoffAt: kickoffAt ? new Date(kickoffAt).toISOString() : null,
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
