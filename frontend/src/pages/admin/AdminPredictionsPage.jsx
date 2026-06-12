import { useCallback, useMemo, useState } from 'react';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { formatMatchDate } from '@/lib/dateFormat';

const statusLabels = {
  upcoming: 'Próximo',
  live: 'En vivo',
  finished: 'Finalizado',
};

const emptyCreateForm = { userId: '', matchId: '', homeGoals: '0', awayGoals: '0' };

export default function AdminPredictionsPage() {
  const [userFilter, setUserFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState('');

  const fetchPredictions = useCallback(
    () => adminApi.listPredictions(userFilter !== 'all' ? { userId: userFilter } : {}),
    [userFilter]
  );
  const { data, loading, error, refresh } = useLiveData(fetchPredictions, [userFilter]);

  const fetchUsers = useCallback(() => adminApi.listUsers({ page: 1, limit: 200 }), []);
  const { data: usersData } = useLiveData(fetchUsers, []);

  const fetchMatches = useCallback(() => adminApi.listMatches(), []);
  const { data: matchesData } = useLiveData(fetchMatches, []);

  const predictions = data?.predictions ?? [];
  const allUsers = usersData?.users ?? [];
  const matches = matchesData?.matches ?? [];

  const usersForFilter = useMemo(() => {
    const byId = new Map();
    for (const u of allUsers) {
      byId.set(u.id, { id: u.id, label: u.name || u.email || u.id });
    }
    for (const p of predictions) {
      if (!p.userId || byId.has(p.userId)) continue;
      byId.set(p.userId, {
        id: p.userId,
        label: p.userName || p.userEmail || p.userId,
      });
    }
    return [...byId.values()].sort((a, b) =>
      a.label.localeCompare(b.label, 'es', { sensitivity: 'base' })
    );
  }, [allUsers, predictions]);

  async function savePrediction(id, patch) {
    setBusyId(id);
    setMessage('');
    try {
      await adminApi.updatePrediction(id, patch);
      setMessage('Predicción actualizada');
      await refresh();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function removePrediction(id) {
    if (!window.confirm('¿Eliminar esta predicción?')) return;
    setBusyId(id);
    setMessage('');
    try {
      await adminApi.deletePrediction(id);
      setMessage('Predicción eliminada');
      await refresh();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function createPrediction() {
    setMessage('');
    try {
      await adminApi.createPrediction({
        userId: createForm.userId,
        matchId: createForm.matchId,
        homeGoals: Number(createForm.homeGoals),
        awayGoals: Number(createForm.awayGoals),
      });
      setMessage('Predicción creada');
      setShowCreate(false);
      setCreateForm(emptyCreateForm);
      await refresh();
    } catch (err) {
      setMessage(err.message);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">Predicciones</h2>
          <p className="text-sm text-slate-400">
            Ver, crear, editar marcadores predichos, puntos y eliminar predicciones.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? 'Cancelar' : 'Nueva predicción'}
        </Button>
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

      {showCreate ? (
        <Card className="border-slate-800 bg-slate-900">
          <CardHeader>
            <CardTitle className="text-base">Crear predicción</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select
              value={createForm.userId}
              onValueChange={(v) => setCreateForm((f) => ({ ...f, userId: v }))}
            >
              <SelectTrigger className="border-slate-700 bg-slate-950">
                <SelectValue placeholder="Usuario" />
              </SelectTrigger>
              <SelectContent>
                {allUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} · {u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={createForm.matchId}
              onValueChange={(v) => setCreateForm((f) => ({ ...f, matchId: v }))}
            >
              <SelectTrigger className="border-slate-700 bg-slate-950">
                <SelectValue placeholder="Partido" />
              </SelectTrigger>
              <SelectContent>
                {matches.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.homeTeamId} vs {m.awayTeamId}
                    {m.group ? ` (${m.group})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              min={0}
              placeholder="Goles local"
              value={createForm.homeGoals}
              onChange={(e) => setCreateForm((f) => ({ ...f, homeGoals: e.target.value }))}
              className="border-slate-700 bg-slate-950"
            />
            <Input
              type="number"
              min={0}
              placeholder="Goles visitante"
              value={createForm.awayGoals}
              onChange={(e) => setCreateForm((f) => ({ ...f, awayGoals: e.target.value }))}
              className="border-slate-700 bg-slate-950"
            />
            <Button size="sm" className="sm:col-span-2 lg:col-span-4" onClick={createPrediction}>
              Crear
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {message ? <p className="text-sm text-amber-300">{message}</p> : null}

      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-800">
              <TableHead>Partido</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Predicción</TableHead>
              <TableHead>Pts / Bonus</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {predictions.map((p) => (
              <PredictionRow
                key={p.id}
                prediction={p}
                busy={busyId === p.id}
                onSave={savePrediction}
                onDelete={removePrediction}
              />
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

function PredictionRow({ prediction, busy, onSave, onDelete }) {
  const [homeGoals, setHomeGoals] = useState(String(prediction.homeGoals ?? 0));
  const [awayGoals, setAwayGoals] = useState(String(prediction.awayGoals ?? 0));
  const [pointsEarned, setPointsEarned] = useState(
    prediction.pointsEarned === null ? '' : String(prediction.pointsEarned)
  );
  const [bonusPoint, setBonusPoint] = useState(String(prediction.bonusPoint ?? 0));

  return (
    <TableRow className="border-slate-800">
      <TableCell>
        <p className="font-medium">{prediction.match?.label ?? '—'}</p>
        {prediction.match ? (
          <p className="text-xs text-slate-500">
            Grupo {prediction.match.group || '—'}
            {prediction.match.kickoffAt
              ? ` · ${formatMatchDate({ kickoffAt: prediction.match.kickoffAt })}`
              : ''}
            {prediction.match.status
              ? ` · ${statusLabels[prediction.match.status] ?? prediction.match.status}`
              : ''}
          </p>
        ) : null}
      </TableCell>
      <TableCell>
        <p>{prediction.userName || '—'}</p>
        <p className="text-xs text-slate-500">{prediction.userEmail}</p>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Input
            className="h-8 w-14 border-slate-700 bg-slate-950 tabular-nums"
            value={homeGoals}
            onChange={(e) => setHomeGoals(e.target.value)}
          />
          <span>-</span>
          <Input
            className="h-8 w-14 border-slate-700 bg-slate-950 tabular-nums"
            value={awayGoals}
            onChange={(e) => setAwayGoals(e.target.value)}
          />
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Input
            className="h-8 w-14 border-slate-700 bg-slate-950 tabular-nums"
            placeholder="Pts"
            value={pointsEarned}
            onChange={(e) => setPointsEarned(e.target.value)}
          />
          <span className="text-slate-500">+</span>
          <Input
            className="h-8 w-12 border-slate-700 bg-slate-950 tabular-nums"
            placeholder="B"
            value={bonusPoint}
            onChange={(e) => setBonusPoint(e.target.value)}
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
              onSave(prediction.id, {
                homeGoals: Number(homeGoals),
                awayGoals: Number(awayGoals),
                pointsEarned: pointsEarned === '' ? null : Number(pointsEarned),
                bonusPoint: Number(bonusPoint || 0),
              })
            }
          >
            Guardar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-red-400"
            disabled={busy}
            onClick={() => onDelete(prediction.id)}
          >
            Eliminar
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
