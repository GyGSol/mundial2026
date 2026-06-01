import { useEffect, useMemo, useState } from 'react';
import { CircleHelp } from 'lucide-react';
import { competitionGroupsApi } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Input } from '@/components/ui/input.jsx';

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

export default function GroupsPage() {
  const { user, refreshUser } = useAuth();
  const [allGroups, setAllGroups] = useState([]);
  const [myGroups, setMyGroups] = useState([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [newPrizesWinnersCount, setNewPrizesWinnersCount] = useState(0);
  const [newPrizes, setNewPrizes] = useState([]);
  const [editing, setEditing] = useState({});
  const [joinGroupId, setJoinGroupId] = useState('');
  const [joinLoading, setJoinLoading] = useState('');
  const [savingGroup, setSavingGroup] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [error, setError] = useState('');

  const loadData = async () => {
    const [all, mine] = await Promise.all([competitionGroupsApi.list(), competitionGroupsApi.my()]);
    setAllGroups(all.groups ?? []);
    setMyGroups(mine.groups ?? []);
  };

  useEffect(() => {
    loadData().catch((err) => setError(err.message));
  }, []);

  const myIds = useMemo(() => new Set(myGroups.map((group) => group.id)), [myGroups]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setSavingGroup(true);
    try {
      await competitionGroupsApi.create(
        newGroupName,
        newGroupDescription,
        newPrizesWinnersCount,
        newPrizes
      );
      setNewGroupName('');
      setNewGroupDescription('');
      setNewPrizesWinnersCount(0);
      setNewPrizes([]);
      await Promise.all([loadData(), refreshUser()]);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingGroup(false);
    }
  };

  const handleJoin = async (groupId) => {
    setError('');
    setJoinLoading(groupId);
    try {
      await competitionGroupsApi.join(groupId);
      await Promise.all([loadData(), refreshUser()]);
    } catch (err) {
      setError(err.message);
    } finally {
      setJoinLoading('');
    }
  };

  const handleJoinSpecific = async (e) => {
    e.preventDefault();
    if (!joinGroupId) return;
    await handleJoin(joinGroupId);
    setJoinGroupId('');
  };

  const handleSetActive = async (groupId) => {
    setError('');
    try {
      await competitionGroupsApi.setActive(groupId);
      await refreshUser();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSaveEdit = async (groupId) => {
    const row = editing[groupId];
    if (!row?.name?.trim()) return;
    setError('');
    try {
      await competitionGroupsApi.update(
        groupId,
        row.name,
        row.description || '',
        row.prizesWinnersCount || 0,
        row.prizes || []
      );
      await loadData();
      setEditing((prev) => ({ ...prev, [groupId]: null }));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Grupos</h1>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => setShowHelp((value) => !value)}
            title="Ayuda de grupos"
            aria-label="Mostrar ayuda de grupos"
          >
            <CircleHelp className="size-4" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Participá en varios grupos con tus pronósticos y elegí cuál usar como contexto activo.
          Solo el creador (administrador) puede editar los datos del grupo.
        </p>
      </div>

      {showHelp && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">¿Cómo funcionan los grupos?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>- Podés participar en varios grupos con la misma cuenta y los mismos pronósticos.</p>
            <p>- El botón <strong>Usar</strong> define el grupo activo para vistas filtradas.</p>
            <p>- En ranking podés ver el modo general (todos) o un grupo puntual.</p>
            <p>- Si quedás sin grupo, seguís en “Ranking · Sin grupo” con tus puntos intactos.</p>
            <p>
              - El <strong>administrador del grupo</strong> (creador) es quien puede editar nombre,
              descripción y premios.
            </p>
            <p>
              - Premios: definís cuántos puestos ganan premio y opcionalmente qué premio recibe cada
              puesto.
            </p>
          </CardContent>
        </Card>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Crear grupo</CardTitle>
          <CardDescription>
            Definí nombre, descripción y premios del grupo. Como creador quedás como administrador
            y luego podés editar estos datos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="grid grid-cols-1 gap-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
              <div className="md:col-span-4">
                <label className="mb-1 block text-sm font-medium">Nombre del grupo</label>
                <Input
                  placeholder="Ej: Amigos del Mundial"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  required
                />
              </div>

              <div className="md:col-span-5">
                <label className="mb-1 block text-sm font-medium">Descripción (opcional)</label>
                <Input
                  placeholder="Ej: Pronósticos entre amigos de la oficina"
                  value={newGroupDescription}
                  onChange={(e) => setNewGroupDescription(e.target.value)}
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium">Puestos premiados</label>
                <Input
                  type="number"
                  min={0}
                  max={10}
                  value={newPrizesWinnersCount}
                  onChange={(e) => {
                    const count = Number(e.target.value || 0);
                    setNewPrizesWinnersCount(count);
                    setNewPrizes((prev) => normalizePrizeRows(count, prev));
                  }}
                />
              </div>

              <div className="md:col-span-1 md:self-end">
                <Button type="submit" disabled={savingGroup} className="w-full">
                  {savingGroup ? 'Guardando...' : 'Crear'}
                </Button>
              </div>
            </div>

            <div className="rounded-md border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
              Si ponés <strong>0</strong>, el grupo queda sin premios. Si ponés <strong>3</strong>,
              podrás definir premio para 1°, 2° y 3° (opcional en cada puesto).
            </div>

          {newPrizesWinnersCount > 0 && (
            <div className="grid gap-2 sm:grid-cols-2">
              <p className="sm:col-span-2 text-sm font-medium">Detalle de premios por puesto</p>
              {newPrizes.map((row) => (
                <Input
                  key={`new-prize-${row.position}`}
                  placeholder={`Puesto ${row.position}: ej. $20 / Camiseta / Cena (opcional)`}
                  value={row.prize}
                  onChange={(e) =>
                    setNewPrizes((prev) =>
                      prev.map((item) =>
                        item.position === row.position ? { ...item, prize: e.target.value } : item
                      )
                    )
                  }
                />
              ))}
            </div>
          )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mis grupos</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {myGroups.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Todavía no participás en grupos. Sumate desde la lista de abajo.
            </p>
          )}
          {myGroups.map((group) => {
            const isOwner = Boolean(group.isAdmin || group.role === 'owner');
            const isActive = user?.competitionGroup?.id === group.id;
            const rowEdit = editing[group.id];
            return (
              <div
                key={group.id}
                className="flex flex-col gap-2 rounded-lg border border-border/70 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  {rowEdit ? (
                    <div className="flex flex-col gap-2">
                      <Input
                        value={rowEdit.name}
                        onChange={(e) =>
                          setEditing((prev) => ({
                            ...prev,
                            [group.id]: { ...rowEdit, name: e.target.value },
                          }))
                        }
                      />
                      <Input
                        value={rowEdit.description || ''}
                        onChange={(e) =>
                          setEditing((prev) => ({
                            ...prev,
                            [group.id]: { ...rowEdit, description: e.target.value },
                          }))
                        }
                      />
                      <Input
                        type="number"
                        min={0}
                        max={10}
                        placeholder="Puestos premiados"
                        value={rowEdit.prizesWinnersCount || 0}
                        onChange={(e) => {
                          const count = Number(e.target.value || 0);
                          setEditing((prev) => ({
                            ...prev,
                            [group.id]: {
                              ...rowEdit,
                              prizesWinnersCount: count,
                              prizes: normalizePrizeRows(count, rowEdit.prizes),
                            },
                          }));
                        }}
                      />
                      {(rowEdit.prizesWinnersCount || 0) > 0 && (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {(rowEdit.prizes || []).map((prizeRow) => (
                            <Input
                              key={`edit-prize-${group.id}-${prizeRow.position}`}
                              placeholder={`Premio puesto ${prizeRow.position} (opcional)`}
                              value={prizeRow.prize}
                              onChange={(e) =>
                                setEditing((prev) => ({
                                  ...prev,
                                  [group.id]: {
                                    ...rowEdit,
                                    prizes: rowEdit.prizes.map((item) =>
                                      item.position === prizeRow.position
                                        ? { ...item, prize: e.target.value }
                                        : item
                                    ),
                                  },
                                }))
                              }
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <p className="font-medium">{group.name}</p>
                      {isOwner && (
                        <p className="text-xs text-emerald-600">Administrador del grupo</p>
                      )}
                      {group.description && (
                        <p className="text-sm text-muted-foreground">{group.description}</p>
                      )}
                      {(group.prizesWinnersCount || 0) > 0 && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Premian {group.prizesWinnersCount} puesto(s)
                          {group.prizes?.some((row) => row.prize) && (
                            <span>
                              {' '}
                              ·{' '}
                              {group.prizes
                                .filter((row) => row.prize)
                                .map((row) => `${row.position}°: ${row.prize}`)
                                .join(' · ')}
                            </span>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={isActive ? 'default' : 'outline'}
                    onClick={() => handleSetActive(group.id)}
                  >
                    {isActive ? 'Activo' : 'Usar'}
                  </Button>
                  {isOwner && !rowEdit && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setEditing((prev) => ({
                          ...prev,
                          [group.id]: {
                            name: group.name,
                            description: group.description || '',
                            prizesWinnersCount: group.prizesWinnersCount || 0,
                            prizes: normalizePrizeRows(group.prizesWinnersCount || 0, group.prizes),
                          },
                        }))
                      }
                    >
                      Editar grupo
                    </Button>
                  )}
                  {isOwner && !rowEdit && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={async () => {
                        const ok = window.confirm(
                          `¿Eliminar definitivamente el grupo \"${group.name}\"?\n\nLos jugadores quedarán sin grupo (sin perder puntos).`
                        );
                        if (!ok) return;
                        setError('');
                        try {
                          await competitionGroupsApi.remove(group.id);
                          await Promise.all([loadData(), refreshUser()]);
                        } catch (err) {
                          setError(err.message);
                        }
                      }}
                    >
                      Eliminar grupo
                    </Button>
                  )}
                  {!isOwner && (
                    <span className="self-center text-xs text-muted-foreground">
                      Solo el administrador puede editar
                    </span>
                  )}
                  {isOwner && rowEdit && (
                    <>
                      <Button size="sm" onClick={() => handleSaveEdit(group.id)}>
                        Guardar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditing((prev) => ({ ...prev, [group.id]: null }))}
                      >
                        Cancelar
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Unirse a un grupo específico</CardTitle>
          <CardDescription>
            Si no lo creaste vos, podés unirte seleccionándolo por nombre.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleJoinSpecific} className="grid grid-cols-1 gap-3 md:grid-cols-12">
            <Input
              className="md:col-span-10"
              list="groups-options"
              placeholder="Escribí o pegá el ID del grupo, o elegilo por nombre abajo"
              value={joinGroupId}
              onChange={(e) => setJoinGroupId(e.target.value)}
            />
            <datalist id="groups-options">
              {allGroups
                .filter((group) => !myIds.has(group.id))
                .map((group) => (
                  <option key={`join-${group.id}`} value={group.id}>
                    {group.name}
                  </option>
                ))}
            </datalist>
            <Button type="submit" className="md:col-span-2" disabled={!joinGroupId}>
              Unirme
            </Button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">
            Consejo: también podés unirte desde la lista “Todos los grupos”.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Todos los grupos</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {allGroups.map((group) => (
            <div
              key={group.id}
              className="flex items-center justify-between rounded-lg border border-border/70 p-3"
            >
              <div>
                <p className="font-medium">{group.name}</p>
                <p className="text-sm text-muted-foreground">{group.memberCount} jugadores</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={myIds.has(group.id) || joinLoading === group.id}
                onClick={() => handleJoin(group.id)}
              >
                {myIds.has(group.id) ? 'Ya participás' : joinLoading === group.id ? 'Uniendo...' : 'Unirme'}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
