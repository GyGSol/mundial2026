import { useCallback, useMemo, useState } from 'react';
import { adminApi } from '../../api/adminClient.js';
import { useLiveData } from '../../hooks/useLiveData.js';
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
import { formatMatchDate } from '@/lib/dateFormat';

const statusLabels = {
  upcoming: 'Próximo',
  live: 'En vivo',
  finished: 'Finalizado',
};

export default function AdminPredictionsPage() {
  const [userFilter, setUserFilter] = useState('all');

  const fetchPredictions = useCallback(() => adminApi.listPredictions(), []);
  const { data, loading, error } = useLiveData(fetchPredictions, []);

  const allPredictions = data?.predictions ?? [];

  const usersForFilter = useMemo(() => {
    const byId = new Map();
    for (const p of allPredictions) {
      if (!p.userId || byId.has(p.userId)) continue;
      byId.set(p.userId, {
        id: p.userId,
        label: p.userName || p.userEmail || p.userId,
      });
    }
    return [...byId.values()].sort((a, b) =>
      a.label.localeCompare(b.label, 'es', { sensitivity: 'base' })
    );
  }, [allPredictions]);

  const predictions = useMemo(() => {
    if (userFilter === 'all') return allPredictions;
    return allPredictions.filter((p) => p.userId === userFilter);
  }, [allPredictions, userFilter]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold">Predicciones</h2>
        <p className="text-sm text-slate-400">
          Todas las predicciones cargadas por los jugadores. Filtrá por usuario.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">Usuario</label>
          <Select value={userFilter} onValueChange={setUserFilter}>
            <SelectTrigger className="w-72 border-slate-700 bg-slate-950">
              <SelectValue placeholder="Todos los usuarios" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los usuarios</SelectItem>
              {usersForFilter.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="self-end text-sm text-slate-500">
          {loading
            ? 'Cargando…'
            : `${predictions.length} predicción${predictions.length === 1 ? '' : 'es'}`}
        </p>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-800">
              <TableHead>Partido</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Predicción</TableHead>
              <TableHead>Resultado real</TableHead>
              <TableHead className="text-right">Pts</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {predictions.map((p) => (
              <TableRow key={p.id} className="border-slate-800">
                <TableCell>
                  <p className="font-medium">{p.match?.label ?? '—'}</p>
                  {p.match ? (
                    <p className="text-xs text-slate-500">
                      Grupo {p.match.group || '—'}
                      {p.match.kickoffAt
                        ? ` · ${formatMatchDate({ kickoffAt: p.match.kickoffAt })}`
                        : ''}
                    </p>
                  ) : null}
                </TableCell>
                <TableCell>
                  <p>{p.userName || '—'}</p>
                  <p className="text-xs text-slate-500">{p.userEmail}</p>
                </TableCell>
                <TableCell className="tabular-nums">
                  {p.homeGoals} - {p.awayGoals}
                </TableCell>
                <TableCell className="tabular-nums text-slate-400">
                  {p.match
                    ? `${p.match.homeScore} - ${p.match.awayScore} (${statusLabels[p.match.status] ?? p.match.status})`
                    : '—'}
                </TableCell>
                <TableCell className="text-right tabular-nums">{p.pointsEarned}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!loading && !predictions.length && !error ? (
          <p className="p-4 text-sm text-slate-500">Sin predicciones cargadas.</p>
        ) : null}
      </div>
    </div>
  );
}
