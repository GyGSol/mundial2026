import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CircleHelp } from 'lucide-react';
import { competitionGroupsApi } from '../api/client.js';
import FormField from '../components/FormField.jsx';
import GroupDirectoryRow from '../components/GroupDirectoryRow.jsx';
import GroupInvitePanel from '../components/GroupInvitePanel.jsx';
import InfoPanel, { InfoList } from '../components/InfoPanel.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Input } from '@/components/ui/input.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';

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
  const { user, refreshUser, isAuthenticated, loading: authLoading } = useAuth();
  const location = useLocation();
  const [allGroups, setAllGroups] = useState([]);
  const [myGroups, setMyGroups] = useState([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [newPrizesWinnersCount, setNewPrizesWinnersCount] = useState(0);
  const [newPrizes, setNewPrizes] = useState([]);
  const [editing, setEditing] = useState({});
  const [joinGroupId, setJoinGroupId] = useState(undefined);
  const [joinLoading, setJoinLoading] = useState('');
  const [leaveLoading, setLeaveLoading] = useState('');
  const [savingGroup, setSavingGroup] = useState(false);
  const [showHelp, setShowHelp] = useState(
    Boolean(location.state?.welcome || location.state?.created)
  );
  const [pageLoading, setPageLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState(() => {
    if (location.state?.successMessage) {
      return location.state.successMessage;
    }
    if (location.state?.welcome) {
      return 'Cuenta creada. Ahora creá un grupo o unite a uno existente para aparecer en un ranking.';
    }
    if (location.state?.created) {
      return 'Grupo creado. Copiá el enlace de invitación en "Mis grupos" y compartilo con quien quieras sumar.';
    }
    return '';
  });
  const [error, setError] = useState('');

  const loadData = async () => {
    const all = await competitionGroupsApi.list();
    setAllGroups(all.groups ?? []);

    if (isAuthenticated) {
      const mine = await competitionGroupsApi.my();
      setMyGroups(mine.groups ?? []);
    } else {
      setMyGroups([]);
    }
  };

  useEffect(() => {
    setPageLoading(true);
    setError('');
    loadData()
      .catch((err) => setError(err.message))
      .finally(() => setPageLoading(false));
  }, [isAuthenticated]);

  const myIds = useMemo(() => new Set(myGroups.map((group) => group.id)), [myGroups]);
  const joinableGroups = useMemo(
    () => allGroups.filter((group) => !group.isVirtual && !myIds.has(group.id)),
    [allGroups, myIds]
  );

  const isNoGroupParticipant = isAuthenticated && myGroups.length === 0;

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) return;
    setError('');
    setSuccessMessage('');
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
      setSuccessMessage(
        'Grupo creado. Ya participás como administrador: copiá el enlace de invitación abajo en “Mis grupos”.'
      );
      await Promise.all([loadData(), refreshUser()]);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingGroup(false);
    }
  };

  const handleJoin = async (groupId) => {
    if (!isAuthenticated) return;
    setError('');
    setSuccessMessage('');
    setJoinLoading(groupId);
    try {
      await competitionGroupsApi.join(groupId);
      setSuccessMessage('Te uniste al grupo. Podés sumarte a más grupos cuando quieras.');
      await Promise.all([loadData(), refreshUser()]);
    } catch (err) {
      setError(err.message);
    } finally {
      setJoinLoading('');
    }
  };

  const handleLeave = async (groupId) => {
    if (!isAuthenticated) return;
    const group = allGroups.find((row) => row.id === groupId);
    const ok = window.confirm(
      `¿Salir de "${group?.name || 'este grupo'}"?\n\nSeguirás con tus puntos y pronósticos. Si no tenés otro grupo, pasás a Sin grupo.`
    );
    if (!ok) return;

    setError('');
    setSuccessMessage('');
    setLeaveLoading(groupId);
    try {
      await competitionGroupsApi.leave(groupId);
      setSuccessMessage('Saliste del grupo. Podés unirte de nuevo cuando quieras.');
      await Promise.all([loadData(), refreshUser()]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLeaveLoading('');
    }
  };

  const handleJoinSpecific = async (e) => {
    e.preventDefault();
    if (!joinGroupId) return;
    await handleJoin(joinGroupId);
    setJoinGroupId(undefined);
  };

  const handleSetActive = async (groupId) => {
    setError('');
    setSuccessMessage('');
    try {
      await competitionGroupsApi.setActive(groupId);
      await refreshUser();
      setSuccessMessage('Grupo activo actualizado para ranking y vistas filtradas.');
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
      setSuccessMessage('Datos del grupo guardados.');
    } catch (err) {
      setError(err.message);
    }
  };

  if (authLoading || pageLoading) {
    return <p className="text-sm text-muted-foreground">Cargando grupos...</p>;
  }

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
          Los grupos son ligas privadas con ranking propio. Podés estar en varios a la vez: cargás
          pronósticos una vez y competís en cada ranking.
        </p>
      </div>

      <InfoPanel title="Resumen rápido">
        <InfoList
          items={[
            'Crear grupo: armás una liga nueva y sos administrador (podés editar datos y premios).',
            'Unirme: te sumás a un grupo existente; podés repetir esto en tantos grupos como quieras.',
            'Usar: marca el grupo activo para filtrar ranking y algunas vistas (no cambia tus puntos).',
            'Predicciones: son globales por usuario; cada grupo calcula su tabla con los mismos resultados.',
          ]}
        />
      </InfoPanel>

      {!isAuthenticated && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Iniciá sesión para participar</CardTitle>
            <CardDescription>
              Podés ver los grupos existentes, pero para crear o unirte necesitás una cuenta.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link to="/login">Ingresar</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/register">Registrarse</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {showHelp && (
        <InfoPanel title="Guía completa de grupos">
          <InfoList
            items={[
              'Varios grupos: una sola cuenta, mismos pronósticos, rankings independientes por grupo.',
              'Grupo activo (Usar): referencia visual en el encabezado y filtro en Ranking cuando elegís un grupo.',
              'Sin grupo: igual podés jugar; en Ranking aparecés como “Sin grupo” con tus puntos.',
              'Administrador: solo quien creó el grupo puede Editar o Eliminar. Los demás solo participan.',
              'Premios: informativos en la ficha del grupo (no se pagan desde la app).',
              'Invitar amigos (admin): copiá el enlace de invitación en “Mis grupos” y enviálo por WhatsApp, email, etc. Sin emails automáticos desde la app.',
              'Unirse sin enlace: buscá el nombre exacto en “Unirse a un grupo” o en “Todos los grupos”.',
            ]}
          />
        </InfoPanel>
      )}

      {successMessage && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {successMessage}
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {isAuthenticated && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Crear grupo</CardTitle>
              <CardDescription>
                Armá una liga nueva. El nombre debe ser único: otros jugadores lo usarán para
                encontrarte y unirse.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <InfoPanel title="Antes de crear">
                <InfoList
                  items={[
                    'Quedás como administrador: podés editar nombre, descripción y premios después.',
                    'Al crear, el grupo pasa a ser tu grupo activo automáticamente.',
                    'Los premios son opcionales y sirven para documentar qué se lleva cada puesto.',
                    'Después de crear, copiá el enlace de invitación en “Mis grupos” para sumar jugadores.',
                  ]}
                />
              </InfoPanel>
              <form onSubmit={handleCreate} className="grid grid-cols-1 gap-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-12 md:items-end md:gap-3">
                  <FormField
                    className="md:col-span-4"
                    label="Nombre del grupo"
                    hint='Visible para todos. Ej: "Familia López", "Trabajo 2026".'
                  >
                    <Input
                      placeholder="Ej: Amigos del Mundial"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      required
                    />
                  </FormField>

                  <FormField
                    className="md:col-span-5"
                    label="Descripción (opcional)"
                    hint="Breve texto para quienes se unan al grupo."
                  >
                    <Input
                      placeholder="Ej: Pronósticos entre amigos de la oficina"
                      value={newGroupDescription}
                      onChange={(e) => setNewGroupDescription(e.target.value)}
                    />
                  </FormField>

                  <FormField
                    className="md:col-span-2"
                    label="Puestos premiados"
                    hint="0 = sin premios. Máximo 10."
                  >
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
                  </FormField>

                  <div className="md:col-span-1">
                    <Button type="submit" disabled={savingGroup} className="h-9 w-full">
                      {savingGroup ? 'Guardando...' : 'Crear'}
                    </Button>
                  </div>
                </div>

                {newPrizesWinnersCount > 0 && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <p className="sm:col-span-2 text-sm font-medium">Detalle de premios por puesto</p>
                    {newPrizes.map((row) => (
                      <Input
                        key={`new-prize-${row.position}`}
                        placeholder={`Puesto ${row.position}: ej. $20 / Camiseta (opcional)`}
                        value={row.prize}
                        onChange={(e) =>
                          setNewPrizes((prev) =>
                            prev.map((item) =>
                              item.position === row.position
                                ? { ...item, prize: e.target.value }
                                : item
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
              <CardTitle>Mis grupos ({myGroups.length})</CardTitle>
              <CardDescription>
                Administración y grupo activo. Si sos administrador, podés editar o eliminar la liga.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <InfoPanel title="Acciones disponibles">
                <InfoList
                  items={[
                    'Usar / Activo: grupo de referencia en la app (podés cambiarlo cuando quieras).',
                    'Editar grupo (solo admin): nombre, descripción y tabla de premios.',
                    'Eliminar (solo admin): borra la liga; los jugadores conservan puntos y pueden seguir en otros grupos.',
                    'Si no sos admin: solo podés usar el grupo o sumarte a otros desde abajo.',
                    'Invitar (solo admin): enlace copiable en cada grupo que administrás; no enviamos emails desde la app.',
                  ]}
                />
              </InfoPanel>
              {myGroups.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Todavía no participás en ningún grupo. Unite desde el buscador de abajo o creá
                  uno nuevo.
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
                        <>
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
                                  prizes: normalizePrizeRows(
                                    group.prizesWinnersCount || 0,
                                    group.prizes
                                  ),
                                },
                              }))
                            }
                          >
                            Editar grupo
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={async () => {
                              const ok = window.confirm(
                                `¿Eliminar definitivamente el grupo "${group.name}"?\n\nLos jugadores quedarán sin ese grupo (sin perder puntos).`
                              );
                              if (!ok) return;
                              setError('');
                              try {
                                await competitionGroupsApi.remove(group.id);
                                setSuccessMessage('Grupo eliminado.');
                                await Promise.all([loadData(), refreshUser()]);
                              } catch (err) {
                                setError(err.message);
                              }
                            }}
                          >
                            Eliminar
                          </Button>
                        </>
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
                      {!isOwner && !rowEdit && (
                        <>
                          <span className="self-center text-xs text-muted-foreground">
                            Miembro
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={leaveLoading === group.id}
                            onClick={() => handleLeave(group.id)}
                          >
                            {leaveLoading === group.id ? 'Saliendo...' : 'Salir'}
                          </Button>
                        </>
                      )}
                      {isOwner && !rowEdit && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={leaveLoading === group.id}
                          onClick={() => handleLeave(group.id)}
                        >
                          {leaveLoading === group.id ? 'Saliendo...' : 'Salir'}
                        </Button>
                      )}
                    </div>
                    {isOwner && !rowEdit && <GroupInvitePanel group={group} compact />}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Unirse a un grupo</CardTitle>
              <CardDescription>
                Sumate a una liga existente. No reemplaza tus otros grupos: se agrega a “Mis grupos”.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <InfoPanel title="¿Te pasaron un enlace?">
                <InfoList
                  items={[
                    'Abrí el link en el celular o la compu: verás el nombre del grupo y podrás registrarte o ingresar.',
                    'No hace falta buscar el grupo por nombre si entraste por invitación.',
                  ]}
                />
              </InfoPanel>
              <p className="text-sm text-muted-foreground">
                Si no tenés enlace, pedí el nombre exacto al administrador. Después de unirte, tus
                pronósticos ya cargados cuentan para ese ranking.
              </p>
              {joinableGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {allGroups.filter((g) => !g.isVirtual).length === 0
                    ? 'No hay grupos todavía. Creá el primero arriba.'
                    : 'Ya participás en todos los grupos disponibles.'}
                </p>
              ) : (
                <form onSubmit={handleJoinSpecific} className="grid grid-cols-1 gap-3 md:grid-cols-12">
                  <div className="md:col-span-10">
                    <Select value={joinGroupId} onValueChange={setJoinGroupId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccioná un grupo por nombre" />
                      </SelectTrigger>
                      <SelectContent>
                        {joinableGroups.map((group) => (
                          <SelectItem key={`join-${group.id}`} value={group.id}>
                            {group.name} ({group.memberCount} jugadores)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="submit"
                    className="md:col-span-2"
                    disabled={!joinGroupId || Boolean(joinLoading)}
                  >
                    {joinLoading ? 'Uniendo...' : 'Unirme'}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Todos los grupos</CardTitle>
          <CardDescription>
            Listado público de competencia. Hacé clic en un grupo para ver los emails de sus
            jugadores. Incluye Sin grupo (sin liga asignada).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {allGroups.length === 0 && (
            <p className="text-sm text-muted-foreground">Todavía no hay grupos creados.</p>
          )}
          {allGroups.map((group) => (
            <GroupDirectoryRow
              key={group.id}
              group={group}
              isAuthenticated={isAuthenticated}
              isMember={myIds.has(group.id)}
              isNoGroupParticipant={isNoGroupParticipant}
              joinLoading={joinLoading === group.id}
              leaveLoading={leaveLoading === group.id}
              onJoin={handleJoin}
              onLeave={handleLeave}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
