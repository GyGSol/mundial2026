import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../../api/adminClient.js';
import { useLiveData } from '../../hooks/useLiveData.js';
import AdminCard from '../../components/admin/AdminCard.jsx';
import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx';
import AdminStatCard from '../../components/admin/AdminStatCard.jsx';
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

const GROUP_OPTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

const statusLabels = {
  upcoming: 'Próximo',
  live: 'En vivo',
  finished: 'Finalizado',
};

const predictionStateLabels = {
  predicha: 'Predicha',
  faltante: 'Faltante',
  pendiente: 'Pendiente',
};

const predictionStateVariant = {
  predicha: 'default',
  faltante: 'destructive',
  pendiente: 'outline',
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

function formatKickoff(iso) {
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
  const [groupFilter, setGroupFilter] = useState('');
  const [predictionFilter, setPredictionFilter] = useState('all');
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const [selectedLogId, setSelectedLogId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [notesBusy, setNotesBusy] = useState(false);
  const [simulateBusyId, setSimulateBusyId] = useState(null);
  const [message, setMessage] = useState('');

  const filterDeps = [matchNumber, statusFilter, groupFilter, predictionFilter];

  const fetchOverview = useCallback(() => {
    const params = { predictionFilter };
    if (matchNumber.trim()) params.matchNumber = matchNumber.trim();
    if (statusFilter) params.status = statusFilter;
    if (groupFilter) params.group = groupFilter;
    return adminApi.getAiCompetitorOverview(params);
  }, filterDeps);

  const { data, loading, error, refresh } = useLiveData(fetchOverview, filterDeps);
  const stats = data?.stats ?? null;
  const matches = data?.matches ?? [];

  useEffect(() => {
    if (!selectedLogId) {
      setDetail(null);
      setNotes('');
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    setMessage('');

    adminApi
      .getAiCompetitorLog(selectedLogId)
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
  }, [selectedLogId]);

  function selectMatchRow(row) {
    setSelectedMatchId(row.matchId);
    setSelectedLogId(row.latestLogId);
  }

  async function saveNotes() {
    if (!selectedLogId) return;
    setNotesBusy(true);
    setMessage('');
    try {
      const result = await adminApi.updateAiCompetitorLogNotes(selectedLogId, notes);
      setNotes(result.adminNotes ?? '');
      setMessage('Notas guardadas');
      await refresh();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setNotesBusy(false);
    }
  }

  async function simulateMatch(row, event) {
    event?.stopPropagation();
    if (!row.canSimulate) return;

    setSimulateBusyId(row.matchId);
    setMessage('');
    try {
      const result = await adminApi.simulateAiCompetitorPrediction(row.matchId);
      setSelectedMatchId(row.matchId);
      setSelectedLogId(result.id);
      setDetail(result);
      setNotes(result.adminNotes ?? '');
      setMessage('Simulación completada (no reemplaza la predicción oficial)');
      await refresh();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSimulateBusyId(null);
    }
  }

  const selectedRow = matches.find((m) => m.matchId === selectedMatchId) ?? null;

  return (
    <div className={adminPage}>
      <AdminPageHeader
        title="Predictive Modeling (IA)"
        description="Partidos del torneo con estado de predicción del bot, estadísticas de error y simulación de prueba (la predicción oficial solo se guarda en el horario automático ~T-90)."
      >
        <Button variant="outline" size="sm" className={adminBtnOutline} onClick={refresh} disabled={loading}>
          Actualizar
        </Button>
      </AdminPageHeader>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {message ? (
        <p className={`text-sm ${message.includes('completada') || message.includes('guardadas') ? 'text-emerald-400' : 'text-amber-300'}`}>
          {message}
        </p>
      ) : null}

      {stats ? (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <AdminStatCard label="Puntuados" value={stats.partidosPuntuados} hint={`${stats.predichas} predichas · ${stats.faltantes} faltantes · ${stats.pendientes} pendientes`} />
          <AdminStatCard
            label="Promedio pts"
            value={stats.promedioPuntos != null ? stats.promedioPuntos : '—'}
            hint={`${stats.puntosTotales} pts totales`}
          />
          <AdminStatCard
            label="Gdif combinado"
            value={stats.gdifCombinado != null ? stats.gdifCombinado : '—'}
            hint="Menor = mejor precisión de marcador"
          />
          <AdminStatCard
            label="Acierto PA"
            value={stats.tasaAciertoPa != null ? `${stats.tasaAciertoPa}%` : '—'}
            hint={`PA ${stats.aciertos.pa} · GL ${stats.aciertos.gl} · GV ${stats.aciertos.gv} · GT ${stats.aciertos.gt}`}
          />
        </div>
      ) : null}

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
          <FilterField label="Grupo">
            <Select value={groupFilter || 'all'} onValueChange={(v) => setGroupFilter(v === 'all' ? '' : v)}>
              <SelectTrigger className={adminInput}>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {GROUP_OPTIONS.map((g) => (
                  <SelectItem key={g} value={g}>
                    Gr. {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label="Predicción IA">
            <Select value={predictionFilter} onValueChange={setPredictionFilter}>
              <SelectTrigger className={adminInput}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="predicha">Predichas</SelectItem>
                <SelectItem value="faltante">Faltantes</SelectItem>
                <SelectItem value="pendiente">Pendientes</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>
        </div>
      </AdminCard>

      <div className="flex flex-col gap-4">
        <AdminCard>
          <h2 className="mb-3 text-sm font-semibold text-slate-100">Partidos</h2>
          {loading && !matches.length ? <p className={adminMuted}>Cargando…</p> : null}
          {!loading && !matches.length ? (
            <p className={adminMuted}>No hay partidos con los filtros actuales.</p>
          ) : null}

          {matches.length ? (
            <div className={adminTableWrap}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha partido</TableHead>
                    <TableHead>Ejec. oficial</TableHead>
                    <TableHead>Partido</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Predicción</TableHead>
                    <TableHead>Pts / Gdif</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matches.map((row) => {
                    const active = row.matchId === selectedMatchId;
                    const pred = row.prediction;
                    return (
                      <TableRow
                        key={row.matchId}
                        className={active ? 'bg-slate-800/60' : 'cursor-pointer'}
                        onClick={() => selectMatchRow(row)}
                      >
                        <TableCell className="whitespace-nowrap text-xs text-slate-400">
                          {formatKickoff(row.match?.kickoffAt)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-slate-400">
                          {row.officialPredictedAt ? formatKickoff(row.officialPredictedAt) : '—'}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-slate-100">{row.match?.label ?? '—'}</div>
                          <div className="text-xs text-slate-500">
                            {row.match?.externalId ? `#${row.match.externalId}` : ''}
                            {row.match?.group ? ` · Gr. ${row.match.group}` : ''}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant={predictionStateVariant[row.predictionState] ?? 'outline'}>
                              {predictionStateLabels[row.predictionState] ?? row.predictionState}
                            </Badge>
                            <span className="text-xs text-slate-500">
                              {statusLabels[row.match?.status] ?? row.match?.status ?? ''}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {pred?.userSubmitted ? (
                            <span>
                              {pred.homeGoals}-{pred.awayGoals}
                              {row.latestSimulationLogId && !row.latestOfficialLogId ? (
                                <Badge className="ml-1" variant="outline">
                                  sim
                                </Badge>
                              ) : null}
                            </span>
                          ) : row.latestSimulationLogId ? (
                            <span className="text-slate-400">Solo simulación</span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                          {row.match?.homeScore != null && row.match?.awayScore != null ? (
                            <div className="text-xs text-slate-500">
                              Real {row.match.homeScore}-{row.match.awayScore}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-sm">
                          {pred?.pointsEarned != null ? (
                            <>
                              <div>{pred.pointsEarned} pts</div>
                              {pred.goalDiffHome != null ? (
                                <div className="text-xs text-slate-400">
                                  Gdif {pred.goalDiffHome}+{pred.goalDiffAway}
                                </div>
                              ) : null}
                            </>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.canSimulate ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className={adminBtnOutline}
                              disabled={simulateBusyId === row.matchId}
                              onClick={(e) => simulateMatch(row, e)}
                            >
                              {simulateBusyId === row.matchId ? '…' : 'Simular'}
                            </Button>
                          ) : (
                            <span className="text-xs text-slate-600">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </AdminCard>

        {selectedMatchId ? (
          <AdminCard>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-100">Detalle</h2>
              <Button
                size="sm"
                variant="ghost"
                className="text-slate-400 hover:text-slate-200"
                onClick={() => {
                  setSelectedMatchId(null);
                  setSelectedLogId(null);
                }}
              >
                Cerrar
              </Button>
            </div>
            {detailLoading ? (
              <p className={adminMuted}>Cargando detalle…</p>
            ) : detail ? (
              <div className="space-y-4">
              {detail.isSimulation ? (
                <Badge variant="outline" className="border-amber-500/50 text-amber-300">
                  Simulación de prueba — no es la predicción oficial
                </Badge>
              ) : null}

              <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-3 text-sm">
                <p className="font-medium text-slate-100">
                  {detail.match?.label ?? selectedRow?.match?.label ?? 'Partido'}
                </p>
                <p className="text-slate-400">
                  Marcador {detail.isSimulation ? 'simulado' : 'oficial'}: {detail.homeGoals}-{detail.awayGoals}
                  {detail.match?.homeScore != null && detail.match?.awayScore != null
                    ? ` · Resultado real: ${detail.match.homeScore}-${detail.match.awayScore}`
                    : ''}
                </p>
                {detail.createdAt ? (
                  <p className="mt-1 text-xs text-slate-500">
                    {detail.isSimulation ? 'Simulada' : 'Ejecutada oficialmente'}: {formatKickoff(detail.createdAt)}
                  </p>
                ) : null}
                {detail.finalResponse?.reasoning ? (
                  <p className="mt-2 whitespace-pre-wrap text-slate-300">{detail.finalResponse.reasoning}</p>
                ) : null}
              </div>

              <JsonPanel title="Contexto enviado al modelo" value={detail.promptContext} />
              <JsonPanel title="Respuesta cruda (antes de calibración)" value={detail.rawResponse} />
              <JsonPanel title="Respuesta final" value={detail.finalResponse} />

              {!detail.isSimulation ? (
                <div>
                  <h3 className="mb-2 text-sm font-medium text-slate-200">Notas para aprendizaje</h3>
                  <textarea
                    className={`${adminInput} min-h-[120px] w-full resize-y`}
                    placeholder="Anotá qué funcionó, qué falló y qué ajustar en el prompt o datos…"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                  <div className="mt-2 flex justify-end">
                    <Button size="sm" className={adminBtnOutline} onClick={saveNotes} disabled={notesBusy}>
                      {notesBusy ? 'Guardando…' : 'Guardar notas'}
                    </Button>
                  </div>
                </div>
              ) : null}
              </div>
            ) : selectedRow?.latestLogId ? (
              <p className={adminMuted}>Cargando log…</p>
            ) : (
              <div className="space-y-3">
                <p className={adminMuted}>Este partido aún no tiene log de auditoría.</p>
                {selectedRow?.canSimulate ? (
                  <Button
                    size="sm"
                    className={adminBtnOutline}
                    disabled={simulateBusyId === selectedRow.matchId}
                    onClick={() => simulateMatch(selectedRow)}
                  >
                    {simulateBusyId === selectedRow.matchId ? 'Simulando…' : 'Simular predicción'}
                  </Button>
                ) : null}
              </div>
            )}
          </AdminCard>
        ) : null}
      </div>
    </div>
  );
}
