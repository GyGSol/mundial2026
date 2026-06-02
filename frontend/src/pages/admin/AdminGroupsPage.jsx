import { useCallback, useState } from 'react';
import { adminApi } from '../../api/adminClient.js';
import { useLiveData } from '../../hooks/useLiveData.js';
import { Button } from '@/components/ui/button.jsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';

export default function AdminGroupsPage() {
  const [selectedId, setSelectedId] = useState(null);
  const [members, setMembers] = useState([]);
  const [message, setMessage] = useState('');

  const fetchGroups = useCallback(() => adminApi.listGroups(), []);
  const { data, loading, error, refresh } = useLiveData(fetchGroups, []);

  const groups = data?.groups ?? [];

  async function loadMembers(groupId) {
    setSelectedId(groupId);
    setMessage('');
    try {
      const result = await adminApi.getGroupMembers(groupId);
      setMembers(result.members ?? []);
    } catch (err) {
      setMessage(err.message);
      setMembers([]);
    }
  }

  async function deleteGroup(groupId) {
    if (!window.confirm('¿Eliminar este grupo y desvincular a todos los miembros?')) return;
    setMessage('');
    try {
      await adminApi.deleteGroup(groupId);
      setMessage('Grupo eliminado');
      setSelectedId(null);
      setMembers([]);
      await refresh();
    } catch (err) {
      setMessage(err.message);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold">Grupos de competencia</h2>
        <p className="text-sm text-slate-400">Ligas privadas creadas por los usuarios.</p>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {message ? <p className="text-sm text-amber-300">{message}</p> : null}
      {loading && !groups.length ? <p className="text-sm text-slate-400">Cargando…</p> : null}

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
                      onClick={() => loadMembers(group.id)}
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

        {selectedId ? (
          <Card className="border-slate-800 bg-slate-900">
            <CardHeader>
              <CardTitle className="text-base">Miembros</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2 text-sm">
                {members.map((m) => (
                  <li key={m.id || m.email} className="flex justify-between text-slate-300">
                    <span>
                      {m.name} · {m.email}
                    </span>
                  </li>
                ))}
                {!members.length ? <li className="text-slate-500">Sin miembros</li> : null}
              </ul>
            </CardContent>
          </Card>
        ) : (
          <p className="text-sm text-slate-500">Seleccioná un grupo para ver miembros.</p>
        )}
      </div>
    </div>
  );
}
