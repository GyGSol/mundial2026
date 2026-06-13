import { useCallback, useMemo, useState } from 'react';
import { adminApi } from '../../api/adminClient.js';
import { useLiveData } from '../../hooks/useLiveData.js';
import AdminCard from '../../components/admin/AdminCard.jsx';
import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx';
import {
  adminInput,
  adminPage,
  adminTableWrap,
} from '../../components/admin/adminTheme.js';
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
import { formatMatchDate } from '@/lib/dateFormat';

const GROUP_OPTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

const statusLabels = {
  upcoming: 'Próximo',
  live: 'En vivo',
  finished: 'Finalizado',
};

const sourceLabels = {
  user: 'Usuario',
  ai: 'IA',
  admin: 'Admin',
  default: 'Default',
};

function formatMatchOptionLabel(match) {
  const label = match.label ?? `${match.homeTeamId} vs ${match.awayTeamId}`;
  return match.group ? `${label} (${match.group})` : label;
}

function FilterField({ label, children }) {
  return (
    <div className="flex min-w-[140px] flex-col gap-1">
      <label className="text-xs text-slate-400">{label}</label>
      {children}
    </div>
  );
}

export default function AdminPredictionsPage() {
  const [userFilter, setUserFilter] = useState('all');
  const [matchFilter, setMatchFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [scoredFilter, setScoredFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState('');

  const filterDeps = [
    userFilter,
    matchFilter,
    statusFilter,
    groupFilter,
    scoredFilter,
    sourceFilter,
  ];

  const fetchPredictions = useCallback(() => {
    const params = {};
    if (userFilter !== 'all') params.userId = userFilter;
    if (matchFilter !== 'all') params.matchId = matchFilter;
    if (statusFilter) params.status = statusFilter;
    if (groupFilter) params.group = groupFilter;
    if (scoredFilter === 'scored') params.scored = 'true';
    if (scoredFilter === 'pending') params.scored = 'false';
    if (sourceFilter !== 'all') params.source = sourceFilter;
    return adminApi.listPredictions(params);
  }, filterDeps);

  const { data, loading, error, refresh } = useLiveData(fetchPredictions, filterDeps);

  const fetchUsers = useCallback(() => adminApi.listUsers({ page: 1, limit: 200 }), []);
  const { data: usersData } = useLiveData(fetchUsers, []);

  const fetchMatches = useCallback(() => adminApi.listMatches(), []);
  const { data: matchesData } = useLiveData(fetchMatches, []);

  const predictions = data?.predictions ?? [];
  const allUsers = usersData?.users ?? [];
  const matches = matchesData?.matches ?? [];

  const hasActiveFilters =
    userFilter !== 'all' ||
    matchFilter !== 'all' ||
    statusFilter ||
    groupFilter ||
    scoredFilter !== 'all' ||
    sourceFilter !== 'all' ||
    search.trim();

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

  const matchesForFilter = useMemo(() => {
    return matches.filter((m) => {
      if (statusFilter && m.status !== statusFilter) return false;
      if (groupFilter && m.group !== groupFilter) return false;
      return true;
    });
  }, [matches, statusFilter, groupFilter]);

  const filteredPredictions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return predictions;
    return predictions.filter(
      (p) =>
        p.userName?.toLowerCase().includes(q) ||
        p.userEmail?.toLowerCase().includes(q) ||
        p.match?.label?.toLowerCase().includes(q) ||
        p.match?.group?.toLowerCase().includes(q)
    );
  }, [predictions, search]);

  function clearFilters() {
    setUserFilter('all');
    setMatchFilter('all');
    setStatusFilter('');
    setGroupFilter('');
    setScoredFilter('all');
    setSourceFilter('all');
    setSearch('');
  }

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
    <div className={adminPage}>
      <AdminPageHeader
        title="Predicciones"
        description="Ver, crear, editar marcadores predichos, puntos y eliminar predicciones."
      >
        <Button size="sm" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? 'Cancelar' : 'Nueva predicción'}
        </Button>
      </AdminPageHeader>

      <div className="flex flex-wrap items-end gap-3">
        <FilterField label="Usuario">
          <Select value={userFilter} onValueChange={setUserFilter}>
            <SelectTrigger className={`w-56 ${adminInput}`}>
              <SelectValue placeholder="Todos" />
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
        </FilterField>

        <FilterField label="Partido">
          <Select value={matchFilter} onValueChange={setMatchFilter}>
            <SelectTrigger className={`w-56 ${adminInput}`}>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los partidos</SelectItem>
              {matchesForFilter.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {formatMatchOptionLabel(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Estado partido">
          <Select
            value={statusFilter || 'all'}
            onValueChange={(v) => {
              setStatusFilter(v === 'all' ? '' : v);
              setMatchFilter('all');
            }}
          >
            <SelectTrigger className={`w-40 ${adminInput}`}>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="upcoming">Próximos</SelectItem>
              <SelectItem value="live">En vivo</SelectItem>
              <SelectItem value="finished">Finalizados</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Grupo">
          <Select
            value={groupFilter || 'all'}
            onValueChange={(v) => {
              setGroupFilter(v === 'all' ? '' : v);
              setMatchFilter('all');
            }}
          >
            <SelectTrigger className={`w-36 ${adminInput}`}>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {GROUP_OPTIONS.map((g) => (
                <SelectItem key={g} value={g}>
                  Grupo {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Puntos">
          <Select value={scoredFilter} onValueChange={setScoredFilter}>
            <SelectTrigger className={`w-40 ${adminInput}`}>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="scored">Puntuadas</SelectItem>
              <SelectItem value="pending">Sin puntuar</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Origen">
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className={`w-36 ${adminInput}`}>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="user">Usuario</SelectItem>
              <SelectItem value="ai">IA</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="default">Default</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Buscar">
          <Input
            placeholder="Usuario o partido…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-48 ${adminInput}`}
          />
        </FilterField>

        {hasActiveFilters ? (
          <Button variant="ghost" size="sm" className="text-slate-400" onClick={clearFilters}>
            Limpiar filtros
          </Button>
        ) : null}

        <p className="text-sm text-slate-500">
          {loading
            ? 'Cargando…'
            : `${filteredPredictions.length} predicción${filteredPredictions.length === 1 ? '' : 'es'}`}
          {!loading && search.trim() && filteredPredictions.length !== predictions.length
            ? ` (de ${predictions.length})`
            : ''}
        </p>
      </div>

      {showCreate ? (
        <AdminCard title="Crear predicción">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select
              value={createForm.userId}
              onValueChange={(v) => setCreateForm((f) => ({ ...f, userId: v }))}
            >
              <SelectTrigger className={adminInput}>
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
              <SelectTrigger className={adminInput}>
                <SelectValue placeholder="Partido" />
              </SelectTrigger>
              <SelectContent>
                {matches.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {formatMatchOptionLabel(m)}
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
              className={adminInput}
            />
            <Input
              type="number"
              min={0}
              placeholder="Goles visitante"
              value={createForm.awayGoals}
              onChange={(e) => setCreateForm((f) => ({ ...f, awayGoals: e.target.value }))}
              className={adminInput}
            />
            <Button size="sm" className="sm:col-span-2 lg:col-span-4" onClick={createPrediction}>
              Crear
            </Button>
          </div>
        </AdminCard>
      ) : null}

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {message ? <p className="text-sm text-amber-300">{message}</p> : null}

      <AdminCard accent flush contentClassName="p-0">
        <div className={adminTableWrap}>
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
              {filteredPredictions.map((p) => (
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
          {!loading && !filteredPredictions.length && !error ? (
            <p className="p-4 text-sm text-slate-500">
              {hasActiveFilters ? 'Ninguna predicción coincide con los filtros.' : 'Sin predicciones cargadas.'}
            </p>
          ) : null}
        </div>
      </AdminCard>
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
        <p className="text-xs text-slate-500">
          {prediction.userEmail}
          {prediction.predictionSource && prediction.predictionSource !== 'user' ? (
            <span className="ml-1 text-violet-400">
              · {sourceLabels[prediction.predictionSource] ?? prediction.predictionSource}
            </span>
          ) : null}
        </p>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Input
            className={`h-8 w-14 tabular-nums ${adminInput}`}
            value={homeGoals}
            onChange={(e) => setHomeGoals(e.target.value)}
          />
          <span>-</span>
          <Input
            className={`h-8 w-14 tabular-nums ${adminInput}`}
            value={awayGoals}
            onChange={(e) => setAwayGoals(e.target.value)}
          />
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Input
            className={`h-8 w-14 tabular-nums ${adminInput}`}
            placeholder="Pts"
            value={pointsEarned}
            onChange={(e) => setPointsEarned(e.target.value)}
          />
          <span className="text-slate-500">+</span>
          <Input
            className={`h-8 w-12 tabular-nums ${adminInput}`}
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
