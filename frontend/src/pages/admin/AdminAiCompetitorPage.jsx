import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminApi } from '../../api/adminClient.js';
import { useLiveData } from '../../hooks/useLiveData.js';
import AdminCard from '../../components/admin/AdminCard.jsx';
import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx';
import {
  adminBtnOutline,
  adminInput,
  adminMuted,
  adminPage,
  adminTableWrap,
} from '../../components/admin/adminTheme.js';
import { ARGENTINA_TIMEZONE } from '@/lib/dateFormat';
import { Badge } from '@/components/ui/badge.jsx';
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

const statusLabels = {
  upcoming: 'Próximo',
  live: 'En vivo',
  finished: 'Finalizado',
};

function FilterField({ label, children }) {
  return (
    <div className="flex min-w-[140px] flex-col gap-1">
      <label className="text-xs text-slate-400">{label}</label>
      {children}
    </div>
  );
}

function JsonPanel({ title, value }) {
  if (value == null) {
    return (
      <div>
        <h3 className="mb-2 text-sm font-medium text-slate-200">{title}</h3>
        <p className={adminMuted}>Sin datos</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-slate-200">{title}</h3>
      <pre className="max-h-80 overflow-auto rounded-lg border border-slate-700/80 bg-slate-950/80 p-3 text-xs leading-relaxed text-slate-300">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function formatLogDate(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: ARGENTINA_TIMEZONE,
  }).format(new Date(iso));
}

export default function AdminAiCompetitorPage() {
  const [matchNumber, setMatchNumber] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [notesBusy, setNotesBusy] = useState(false);
  const [message, setMessage] = useState('');

  const filterDeps = [matchNumber, statusFilter];

  const fetchLogs = useCallback(() => {
    const params = { limit: 80 };
    if (matchNumber.trim()) params.matchNumber = matchNumber.trim();
    if (statusFilter) params.status = statusFilter;
    return adminApi.listAiCompetitorLogs(params);
  }, filterDeps);

  const { data, loading, error, refresh } = useLiveData(fetchLogs, filterDeps);
  const logs = data?.logs ?? [];

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setNotes('');
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    setMessage('');

    adminApi
      .getAiCompetitorLog(selectedId)
      .then((payload) => {
        if (cancelled) return;
        setDetail(payload);
        setNotes(payload.adminNotes ?? '');
      })
      .catch((err) => {
        if (!cancelled) setMessage(err.message);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const selectedSummary = useMemo(
    () => logs.find((log) => log.id === selectedId) ?? null,
    [logs, selectedId]
  );

  async function saveNotes() {
    if (!selectedId) return;
    setNotesBusy(true);
    setMessage('');
    try {
      const result = await adminApi.updateAiCompetitorLogNotes(selectedId, notes);
      setNotes(result.adminNotes ?? '');
      setMessage('Notas guardadas');
      await refresh();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setNotesBusy(false);
    }
  }

  return (
    <div className={adminPage}>
      <AdminPageHeader
        title="Predictive Modeling (IA)"
        description="Auditoría de predicciones automáticas: contexto enviado al modelo, respuesta cruda y resultado final. Usá las notas para registrar aprendizajes y ajustes futuros."
      >
        <Button variant="outline" size="sm" className={adminBtnOutline} onClick={refresh} disabled={loading}>
          Actualizar
        </Button>
      </AdminPageHeader>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-400">{message}</p> : null}

      <AdminCard className="mb-4">
        <div className="flex flex-wrap gap-3">
          <FilterField label="Nº partido FIFA">
            <Input
              className={adminInput}
              placeholder="ej. 12"
              value={matchNumber}
              onChange={(e) => setMatchNumber(e.target.value)}
            />
          </FilterField>
          <FilterField label="Estado partido">
            <Select value={statusFilter || 'all'} onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}>
              <SelectTrigger className={adminInput}>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="upcoming">Próximo</SelectItem>
                <SelectItem value="live">En vivo</SelectItem>
                <SelectItem value="finished">Finalizado</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>
        </div>
      </AdminCard>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <AdminCard>
          <h2 className="mb-3 text-sm font-semibold text-slate-100">Predicciones registradas</h2>
          {loading && !logs.length ? <p className={adminMuted}>Cargando…</p> : null}
          {!loading && !logs.length ? (
            <p className={adminMuted}>
              Aún no hay logs. Se guardan automáticamente cuando el bot predice ~90 min antes del kickoff.
            </p>
          ) : null}

          {logs.length ? (
            <div className={adminTableWrap}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Partido</TableHead>
                    <TableHead>Marcador</TableHead>
                    <TableHead>Modelo</TableHead>
                    <TableHead>Pts</TableHead>
                    <TableHead>Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => {
                    const active = log.id === selectedId;
                    return (
                      <TableRow
                        key={log.id}
                        className={active ? 'bg-slate-800/60' : 'cursor-pointer'}
                        onClick={() => setSelectedId(log.id)}
                      >
                        <TableCell>
                          <div className="font-medium text-slate-100">{log.match?.label ?? '—'}</div>
                          <div className="text-xs text-slate-400">
                            {log.match?.externalId ? `#${log.match.externalId}` : ''}
                            {log.match?.group ? ` · Gr. ${log.match.group}` : ''}
                            {log.match?.status ? ` · ${statusLabels[log.match.status] ?? log.match.status}` : ''}
                          </div>
                        </TableCell>
                        <TableCell>
                          {log.homeGoals}-{log.awayGoals}
                          {log.calibrationApplied ? (
                            <Badge className="ml-2" variant="outline">
                              calibrado
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-xs text-slate-300">
                          <div>{log.aiModel ?? '—'}</div>
                          <div className="text-slate-500">{log.aiSource ?? ''}</div>
                        </TableCell>
                        <TableCell>
                          {log.scoring?.pointsEarned != null ? (
                            <span>
                              {log.scoring.pointsEarned}
                              {log.scoring.goalDiffHome != null ? (
                                <span className="block text-xs text-slate-400">
                                  Gdif {log.scoring.goalDiffHome}+{log.scoring.goalDiffAway}
                                </span>
                              ) : null}
                            </span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-slate-400">{formatLogDate(log.createdAt)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </AdminCard>

        <AdminCard>
          <h2 className="mb-3 text-sm font-semibold text-slate-100">Detalle</h2>
          {!selectedId ? (
            <p className={adminMuted}>Seleccioná una fila para ver contexto y respuestas.</p>
          ) : detailLoading ? (
            <p className={adminMuted}>Cargando detalle…</p>
          ) : detail ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-3 text-sm">
                <p className="font-medium text-slate-100">
                  {detail.match?.label ?? selectedSummary?.match?.label ?? 'Partido'}
                </p>
                <p className="text-slate-400">
                  Predicción final: {detail.homeGoals}-{detail.awayGoals}
                  {detail.match?.homeScore != null && detail.match?.awayScore != null
                    ? ` · Resultado real: ${detail.match.homeScore}-${detail.match.awayScore}`
                    : ''}
                </p>
                {detail.finalResponse?.reasoning ? (
                  <p className="mt-2 whitespace-pre-wrap text-slate-300">{detail.finalResponse.reasoning}</p>
                ) : null}
              </div>

              <JsonPanel title="Contexto enviado al modelo" value={detail.promptContext} />
              <JsonPanel title="Respuesta cruda (antes de calibración)" value={detail.rawResponse} />
              <JsonPanel title="Respuesta final aplicada" value={detail.finalResponse} />

              <div>
                <h3 className="mb-2 text-sm font-medium text-slate-200">Notas para aprendizaje</h3>
                <textarea
                  className={`${adminInput} min-h-[120px] w-full resize-y`}
                  placeholder="Ej.: el consenso del grupo estaba sesgado; conviene ponderar más xG en este tipo de partido…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
                <div className="mt-2 flex justify-end">
                  <Button size="sm" className={adminBtnOutline} onClick={saveNotes} disabled={notesBusy}>
                    {notesBusy ? 'Guardando…' : 'Guardar notas'}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-red-400">No se pudo cargar el detalle.</p>
          )}
        </AdminCard>
      </div>
    </div>
  );
}
