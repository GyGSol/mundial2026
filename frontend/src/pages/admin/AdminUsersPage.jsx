import { useCallback, useState } from 'react';
import { adminApi } from '../../api/adminClient.js';
import { useLiveData } from '../../hooks/useLiveData.js';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';

export default function AdminUsersPage() {
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [pointsEdit, setPointsEdit] = useState('');
  const [message, setMessage] = useState('');

  const fetchUsers = useCallback(
    () => adminApi.listUsers({ page, limit: 20, q: search }),
    [page, search]
  );
  const { data, loading, error, refresh } = useLiveData(fetchUsers, [page, search]);

  const users = data?.users ?? [];

  async function loadDetail(id) {
    setSelectedId(id);
    setMessage('');
    try {
      const result = await adminApi.getUser(id);
      setDetail(result);
      setPointsEdit(String(result.user.totalPoints ?? 0));
    } catch (err) {
      setMessage(err.message);
      setDetail(null);
    }
  }

  async function savePoints() {
    if (!selectedId) return;
    setMessage('');
    try {
      await adminApi.updateUserPoints(selectedId, Number(pointsEdit));
      setMessage('Puntos actualizados');
      await refresh();
      await loadDetail(selectedId);
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function deleteUser(id) {
    if (!window.confirm('¿Eliminar este usuario y todas sus predicciones?')) return;
    setMessage('');
    try {
      await adminApi.deleteUser(id);
      setMessage('Usuario eliminado');
      setSelectedId(null);
      setDetail(null);
      await refresh();
    } catch (err) {
      setMessage(err.message);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold">Usuarios</h2>
        <p className="text-sm text-slate-400">Buscar, ajustar puntos o eliminar cuentas.</p>
      </div>

      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setSearch(q.trim());
        }}
      >
        <Input
          placeholder="Buscar por nombre o email"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-sm border-slate-700 bg-slate-950"
        />
        <Button type="submit" variant="outline" size="sm">
          Buscar
        </Button>
      </form>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {message ? <p className="text-sm text-amber-300">{message}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800">
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Pts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow
                  key={user.id}
                  className={`cursor-pointer border-slate-800 ${selectedId === user.id ? 'bg-slate-800/60' : ''}`}
                  onClick={() => loadDetail(user.id)}
                >
                  <TableCell>{user.name}</TableCell>
                  <TableCell className="text-sm text-slate-400">{user.email}</TableCell>
                  <TableCell className="text-right tabular-nums">{user.totalPoints}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {loading ? <p className="p-3 text-sm text-slate-400">Cargando…</p> : null}
          <div className="flex items-center justify-between border-t border-slate-800 p-2 text-sm">
            <Button
              variant="ghost"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <span className="text-slate-400">
              Pág. {data?.page ?? page} / {data?.totalPages ?? 1}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={page >= (data?.totalPages ?? 1)}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>

        {detail ? (
          <Card className="border-slate-800 bg-slate-900">
            <CardHeader>
              <CardTitle className="text-base">{detail.user.name}</CardTitle>
              <p className="text-sm text-slate-400">{detail.user.email}</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm">
              <div className="flex items-end gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-slate-400">Puntos totales</label>
                  <Input
                    className="w-28 border-slate-700 bg-slate-950 tabular-nums"
                    value={pointsEdit}
                    onChange={(e) => setPointsEdit(e.target.value)}
                  />
                </div>
                <Button size="sm" onClick={savePoints}>
                  Guardar
                </Button>
              </div>

              <div>
                <p className="mb-1 font-medium text-slate-300">Grupos</p>
                <ul className="flex flex-col gap-1 text-slate-400">
                  {detail.memberships.length ? (
                    detail.memberships.map((m) => (
                      <li key={`${m.groupId}-${m.role}`}>
                        {m.groupName || m.groupId} · {m.role}
                      </li>
                    ))
                  ) : (
                    <li>Sin membresías</li>
                  )}
                </ul>
              </div>

              <div>
                <p className="mb-1 font-medium text-slate-300">Últimas predicciones</p>
                <ul className="flex flex-col gap-1 text-slate-400">
                  {detail.recentPredictions.map((p) => (
                    <li key={p.id}>
                      {p.homeGoals}-{p.awayGoals} · {p.pointsEarned} pts
                      {p.match ? ` · ${p.match.homeTeamId} vs ${p.match.awayTeamId}` : ''}
                    </li>
                  ))}
                </ul>
              </div>

              <Button variant="outline" size="sm" className="text-red-400" onClick={() => deleteUser(detail.user.id)}>
                Eliminar usuario
              </Button>
            </CardContent>
          </Card>
        ) : (
          <p className="text-sm text-slate-500">Seleccioná un usuario para ver detalle.</p>
        )}
      </div>
    </div>
  );
}
