import { useCallback, useState } from 'react';
import { adminApi } from '../../api/adminClient.js';
import { useLiveData } from '../../hooks/useLiveData.js';
import AdminCard from '../../components/admin/AdminCard.jsx';
import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx';
import {
  ADMIN_BANNERS,
  adminInput,
  adminMuted,
  adminPage,
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
function normalizePrizeRows(count, existing = []) {
  const safeCount = Math.max(0, Math.min(Number(count || 0), 10));
  const byPos = Object.fromEntries(
    (Array.isArray(existing) ? existing : []).map((row) => [Number(row.position), row.prize || ''])
  );
  return Array.from({ length: safeCount }, (_, index) => ({
    position: index + 1,
    prize: byPos[index + 1] || '',
  }));
}

const emptyForm = {
  name: '',
  description: '',
  prizesWinnersCount: 0,
  prizes: [],
};

export default function AdminGroupsPage() {
  const [selectedId, setSelectedId] = useState(null);
  const [members, setMembers] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [message, setMessage] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [addMemberEmail, setAddMemberEmail] = useState('');
  const [actionLoading, setActionLoading] = useState('');

  const fetchGroups = useCallback(() => adminApi.listGroups(), []);
  const { data, loading, error, refresh } = useLiveData(fetchGroups, []);

  const groups = data?.groups ?? [];
  const selectedGroup = groups.find((g) => g.id === selectedId);

  async function loadGroupDetail(groupId) {
    setSelectedId(groupId);
    setMessage('');
    try {
      const [membersResult, requestsResult] = await Promise.all([
        adminApi.getGroupMembers(groupId),
        adminApi.listJoinRequests(groupId),
      ]);
      setMembers(membersResult.members ?? []);
      setJoinRequests(requestsResult.requests ?? []);
    } catch (err) {
      setMessage(err.message);
      setMembers([]);
      setJoinRequests([]);
    }
  }

  function applyGroupToForm(group) {
    setForm({
      name: group.name,
      description: group.description || '',
      prizesWinnersCount: group.prizesWinnersCount || 0,
      prizes: normalizePrizeRows(group.prizesWinnersCount || 0, group.prizes || []),
    });
  }

  async function openEdit(group) {
    setShowCreate(false);
    await loadGroupDetail(group.id);
    try {
      const result = await adminApi.getGroup(group.id);
      applyGroupToForm(result.group);
    } catch {
      applyGroupToForm(group);
    }
  }

  async function saveGroup() {
    if (!form.name?.trim()) return;
    setActionLoading('save');
    setMessage('');
    try {
      const body = {
        name: form.name.trim(),
        description: form.description || '',
        prizesWinnersCount: form.prizesWinnersCount || 0,
        prizes: form.prizes || [],
      };
      if (selectedId && !showCreate) {
        await adminApi.updateGroup(selectedId, body);
        setMessage('Grupo actualizado');
        await refresh();
        await loadGroupDetail(selectedId);
        const result = await adminApi.getGroup(selectedId);
        applyGroupToForm(result.group);
      } else {
        const result = await adminApi.createGroup(body);
        setMessage('Grupo creado');
        setShowCreate(false);
        const newId = result.group?.id;
        if (newId) {
          setSelectedId(newId);
          await refresh();
          await loadGroupDetail(newId);
          applyGroupToForm(result.group);
        } else {
          await refresh();
        }
      }
    } catch (err) {
      setMessage(err.message);
    } finally {
      setActionLoading('');
    }
  }

  async function deleteGroup(groupId) {
    if (!window.confirm('¿Eliminar este grupo y desvincular a todos los miembros?')) return;
    setMessage('');
    try {
      await adminApi.deleteGroup(groupId);
      setMessage('Grupo eliminado');
      if (selectedId === groupId) {
        setSelectedId(null);
        setMembers([]);
        setJoinRequests([]);
        setForm(emptyForm);
      }
      await refresh();
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function addMember() {
    if (!selectedId || !addMemberEmail.trim()) return;
    setActionLoading('add-member');
    setMessage('');
    try {
      await adminApi.addGroupMember(selectedId, { email: addMemberEmail.trim() });
      setAddMemberEmail('');
      setMessage('Jugador agregado al grupo');
      await loadGroupDetail(selectedId);
      await refresh();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setActionLoading('');
    }
  }

  async function removeMember(userId, name) {
    if (!selectedId) return;
    if (!window.confirm(`¿Expulsar a "${name}" del grupo?`)) return;
    setActionLoading(`remove-${userId}`);
    try {
      await adminApi.removeGroupMember(selectedId, userId);
      setMessage('Jugador expulsado');
      await loadGroupDetail(selectedId);
      await refresh();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setActionLoading('');
    }
  }

  async function changeMemberRole(userId, role) {
    if (!selectedId) return;
    setActionLoading(`role-${userId}`);
    setMessage('');
    try {
      await adminApi.updateGroupMemberRole(selectedId, userId, role);
      setMessage('Rol actualizado');
      await loadGroupDetail(selectedId);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setActionLoading('');
    }
  }

  async function approveRequest(userId) {
    if (!selectedId) return;
    setActionLoading(`approve-${userId}`);
    try {
      await adminApi.approveJoinRequest(selectedId, userId);
      setMessage('Solicitud aprobada');
      await loadGroupDetail(selectedId);
      await refresh();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setActionLoading('');
    }
  }

  async function rejectRequest(userId) {
    if (!selectedId) return;
    setActionLoading(`reject-${userId}`);
    try {
      await adminApi.rejectJoinRequest(selectedId, userId);
      setMessage('Solicitud rechazada');
      await loadGroupDetail(selectedId);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setActionLoading('');
    }
  }

  return (
    <div className={adminPage}>
      <AdminPageHeader
        title="Grupos de competencia"
        description="Crear, editar, ingresar o expulsar jugadores y gestionar solicitudes."
      >
        <Button
          size="sm"
          onClick={() => {
            setShowCreate(true);
            setSelectedId(null);
            setMembers([]);
            setJoinRequests([]);
            setForm(emptyForm);
          }}
        >
          Crear grupo
        </Button>
      </AdminPageHeader>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {message ? <p className="text-sm text-amber-300">{message}</p> : null}
      {loading && !groups.length ? <p className={adminMuted}>Cargando…</p> : null}

      <AdminCard banner={ADMIN_BANNERS.groups} flush contentClassName="p-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800">
                <TableHead>Nombre</TableHead>
                <TableHead>Miembros</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => (
                <TableRow key={group.id} className="border-slate-800">
                  <TableCell>
                    <button
                      type="button"
                      className="text-left hover:text-amber-200"
                      onClick={() => openEdit(group)}
                    >
                      {group.name}
                    </button>
                    {group.description ? (
                      <p className="text-xs text-slate-500">{group.description}</p>
                    ) : null}
                  </TableCell>
                  <TableCell className="tabular-nums">{group.memberCount}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-400"
                      onClick={() => deleteGroup(group.id)}
                    >
                      Eliminar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <AdminCard
          title={
            showCreate
              ? 'Nuevo grupo'
              : selectedGroup
                ? `Editar: ${selectedGroup.name}`
                : 'Detalle del grupo'
          }
        >
          <div className="flex flex-col gap-4">
            {showCreate || selectedId ? (
              <>
                <Input
                  placeholder="Nombre"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className={adminInput}
                />
                <Input
                  placeholder="Descripción"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className={adminInput}
                />
                <Input
                  type="number"
                  min={0}
                  max={10}
                  placeholder="Puestos premiados"
                  value={form.prizesWinnersCount}
                  onChange={(e) => {
                    const count = Number(e.target.value || 0);
                    setForm((f) => ({
                      ...f,
                      prizesWinnersCount: count,
                      prizes: normalizePrizeRows(count, f.prizes),
                    }));
                  }}
                  className={adminInput}
                />
                {form.prizesWinnersCount > 0
                  ? form.prizes.map((row) => (
                      <Input
                        key={`prize-${row.position}`}
                        placeholder={`Premio puesto ${row.position}`}
                        value={row.prize}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            prizes: f.prizes.map((item) =>
                              item.position === row.position
                                ? { ...item, prize: e.target.value }
                                : item
                            ),
                          }))
                        }
                        className={adminInput}
                      />
                    ))
                  : null}
                <Button
                  size="sm"
                  disabled={actionLoading === 'save'}
                  onClick={saveGroup}
                >
                  {actionLoading === 'save' ? 'Guardando…' : showCreate ? 'Crear' : 'Guardar cambios'}
                </Button>
              </>
            ) : (
              <p className="text-sm text-slate-500">
                Seleccioná un grupo de la lista o creá uno nuevo.
              </p>
            )}

            {selectedId && !showCreate ? (
              <>
                <div>
                  <p className="mb-2 text-xs font-medium text-slate-400">Solicitudes pendientes</p>
                  {joinRequests.length === 0 ? (
                    <p className="text-sm text-slate-500">Ninguna solicitud pendiente.</p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {joinRequests.map((req) => (
                        <li
                          key={req.userId}
                          className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-300"
                        >
                          <span>
                            {req.name} · {req.email}
                          </span>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              disabled={Boolean(actionLoading)}
                              onClick={() => approveRequest(req.userId)}
                            >
                              Aprobar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={Boolean(actionLoading)}
                              onClick={() => rejectRequest(req.userId)}
                            >
                              Rechazar
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium text-slate-400">Ingresar jugador</p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Email del usuario"
                      value={addMemberEmail}
                      onChange={(e) => setAddMemberEmail(e.target.value)}
                      className={adminInput}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actionLoading === 'add-member'}
                      onClick={addMember}
                    >
                      Ingresar
                    </Button>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium text-slate-400">Miembros</p>
                  <ul className="flex flex-col gap-2 text-sm">
                    {members.map((m) => (
                      <li
                        key={m.id}
                        className="flex flex-wrap items-center justify-between gap-2 text-slate-300"
                      >
                        <span>
                          {m.name} · {m.email}
                        </span>
                        <div className="flex items-center gap-1">
                          <select
                            value={m.role}
                            onChange={(e) => changeMemberRole(m.id, e.target.value)}
                            disabled={Boolean(actionLoading)}
                            className={`rounded border px-2 py-1 text-xs ${adminInput}`}
                          >
                            <option value="member">member</option>
                            <option value="owner">owner</option>
                          </select>
                          {m.role !== 'owner' ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-400"
                              disabled={actionLoading === `remove-${m.id}`}
                              onClick={() => removeMember(m.id, m.name)}
                            >
                              Expulsar
                            </Button>
                          ) : null}
                        </div>
                      </li>
                    ))}
                    {!members.length ? (
                      <li className="text-slate-500">Sin miembros</li>
                    ) : null}
                  </ul>
                </div>
              </>
            ) : null}
          </div>
        </AdminCard>
      </div>
      </AdminCard>
    </div>
  );
}
