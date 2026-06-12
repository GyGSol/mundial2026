import { useCallback, useState } from 'react';
import { adminApi } from '../../api/adminClient.js';
import { useLiveData } from '../../hooks/useLiveData.js';
import AdminCard from '../../components/admin/AdminCard.jsx';
import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx';
import {
  adminInput,
  adminLabel,
  adminMuted,
  adminPage,
  adminTableWrap,
} from '../../components/admin/adminTheme.js';
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
const emptyCreateForm = { name: '', email: '', password: '', totalPoints: '0' };

export default function AdminUsersPage() {
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [nameEdit, setNameEdit] = useState('');
  const [emailEdit, setEmailEdit] = useState('');
  const [pointsEdit, setPointsEdit] = useState('');
  const [passwordEdit, setPasswordEdit] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [message, setMessage] = useState('');

  const fetchUsers = useCallback(
    () => adminApi.listUsers({ page, limit: 20, q: search }),
    [page, search]
  );
  const { data, loading, error, refresh } = useLiveData(fetchUsers, [page, search]);

  const users = data?.users ?? [];

  async function loadDetail(id) {
    setSelectedId(id);
    setShowCreate(false);
    setMessage('');
    setPasswordEdit('');
    try {
      const result = await adminApi.getUser(id);
      setDetail(result);
      setNameEdit(result.user.name ?? '');
      setEmailEdit(result.user.email ?? '');
      setPointsEdit(String(result.user.totalPoints ?? 0));
    } catch (err) {
      setMessage(err.message);
      setDetail(null);
    }
  }

  async function saveProfile() {
    if (!selectedId) return;
    setMessage('');
    try {
      await adminApi.updateUser(selectedId, {
        name: nameEdit.trim(),
        email: emailEdit.trim(),
      });
      setMessage('Datos actualizados');
      await refresh();
      await loadDetail(selectedId);
    } catch (err) {
      setMessage(err.message);
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

  async function savePassword() {
    if (!selectedId) return;
    const trimmed = passwordEdit.trim();
    if (trimmed.length < 8) {
      setMessage('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (!window.confirm('¿Cambiar la contraseña de este usuario? Cerrará sus sesiones activas.')) {
      return;
    }
    setMessage('');
    try {
      await adminApi.updateUserPassword(selectedId, trimmed);
      setPasswordEdit('');
      setMessage('Contraseña actualizada');
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function createUser() {
    setMessage('');
    try {
      const result = await adminApi.createUser({
        name: createForm.name.trim(),
        email: createForm.email.trim(),
        password: createForm.password,
        totalPoints: Number(createForm.totalPoints || 0),
      });
      setMessage('Usuario creado');
      setShowCreate(false);
      setCreateForm(emptyCreateForm);
      await refresh();
      if (result?.id) await loadDetail(result.id);
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
    <div className={adminPage}>
      <AdminPageHeader
        title="Usuarios"
        description="Crear, editar datos, puntos, contraseña o eliminar cuentas."
      >
        <Button
          size="sm"
          onClick={() => {
            setShowCreate(true);
            setSelectedId(null);
            setDetail(null);
            setCreateForm(emptyCreateForm);
          }}
        >
          Crear usuario
        </Button>
      </AdminPageHeader>

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
          className={`max-w-sm ${adminInput}`}
        />
        <Button type="submit" variant="outline" size="sm">
          Buscar
        </Button>
      </form>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {message ? <p className="text-sm text-amber-300">{message}</p> : null}

      <AdminCard accent flush contentClassName="p-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={adminTableWrap}>
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
          {loading ? <p className={`p-3 ${adminMuted}`}>Cargando…</p> : null}
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

        {showCreate ? (
          <AdminCard title="Nuevo usuario">
            <div className="flex flex-col gap-3 text-sm">
              <Input
                placeholder="Nombre"
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                className={adminInput}
              />
              <Input
                type="email"
                placeholder="Email"
                value={createForm.email}
                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                className={adminInput}
              />
              <Input
                type="password"
                placeholder="Contraseña (mín. 8)"
                minLength={8}
                value={createForm.password}
                onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                className={adminInput}
              />
              <Input
                type="number"
                min={0}
                placeholder="Puntos iniciales"
                value={createForm.totalPoints}
                onChange={(e) => setCreateForm((f) => ({ ...f, totalPoints: e.target.value }))}
                className={adminInput}
              />
              <Button size="sm" onClick={createUser}>
                Crear
              </Button>
            </div>
          </AdminCard>
        ) : detail ? (
          <AdminCard
            header={
              <div>
                <h3 className="text-base font-semibold">{detail.user.name}</h3>
                <p className={adminMuted}>{detail.user.email}</p>
              </div>
            }
          >
            <div className="flex flex-col gap-4 text-sm">
              <div className="flex flex-col gap-2">
                <label className={adminLabel}>Nombre</label>
                <Input
                  className={adminInput}
                  value={nameEdit}
                  onChange={(e) => setNameEdit(e.target.value)}
                />
                <label className={adminLabel}>Email</label>
                <Input
                  type="email"
                  className={adminInput}
                  value={emailEdit}
                  onChange={(e) => setEmailEdit(e.target.value)}
                />
                <Button size="sm" variant="outline" onClick={saveProfile}>
                  Guardar datos
                </Button>
              </div>

              <div className="flex items-end gap-2">
                <div className="flex flex-col gap-1">
                  <label className={adminLabel}>Puntos totales</label>
                  <Input
                    className={`w-28 tabular-nums ${adminInput}`}
                    value={pointsEdit}
                    onChange={(e) => setPointsEdit(e.target.value)}
                  />
                </div>
                <Button size="sm" onClick={savePoints}>
                  Guardar pts
                </Button>
              </div>

              <div className="flex items-end gap-2">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <label className={adminLabel}>Nueva contraseña</label>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    placeholder="Mínimo 8 caracteres"
                    minLength={8}
                    className={adminInput}
                    value={passwordEdit}
                    onChange={(e) => setPasswordEdit(e.target.value)}
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={savePassword}
                  disabled={passwordEdit.length < 8}
                >
                  Cambiar clave
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

              <Button
                variant="outline"
                size="sm"
                className="text-red-400"
                onClick={() => deleteUser(detail.user.id)}
              >
                Eliminar usuario
              </Button>
            </div>
          </AdminCard>
        ) : (
          <p className="text-sm text-slate-500">Seleccioná un usuario o creá uno nuevo.</p>
        )}
      </div>
      </AdminCard>
    </div>
  );
}
