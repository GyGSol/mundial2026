import { useCallback, useEffect, useRef, useState, Fragment } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { adminApi } from '../../api/adminClient.js';
import { useLiveData } from '../../hooks/useLiveData.js';
import MarkdownContent from '../../components/MarkdownContent.jsx';
import AdminCard from '../../components/admin/AdminCard.jsx';
import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx';
import AdminStatCard from '../../components/admin/AdminStatCard.jsx';
import AdminOracleLearningPanel from '../../components/admin/AdminOracleLearningPanel.jsx';
import AdminOracleReviewChat from '../../components/admin/AdminOracleReviewChat.jsx';
import AdminAiAnalyticsSection from '../../components/admin/analytics/AdminAiAnalyticsSection.jsx';
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

const PAGE_TABS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'graficos', label: 'Gráficos' },
  { id: 'partidos', label: 'Partidos' },
];

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

function matchHasFinalScore(match) {
  return match?.status === 'finished' || match?.status === 'live';
}

function matchHasCollapsibleInsight(row) {
  return Boolean(row.postMatchReview?.available || row.predictionReasoning || row.predictionReasoningFull);
}

function MatchAiInsightRow({
  row,
  expanded,
  onToggle,
  reviewState,
  onRefreshReview,
}) {
  const isPostMatch = Boolean(row.postMatchReview?.available);
  if (!matchHasCollapsibleInsight(row)) return null;

  const title = isPostMatch ? 'Análisis de error y aprendizaje (IA)' : 'Razonamiento de la predicción';
  const review = reviewState?.data ?? null;
  const fullReasoning = row.predictionReasoningFull ?? row.prediction?.aiReasoning ?? row.predictionReasoning;
  const previewText = row.postMatchReview?.preview ?? row.predictionReasoning ?? fullReasoning;

  return (
    <TableRow className="hover:bg-transparent" onClick={(event) => event.stopPropagation()}>
      <TableCell colSpan={7} className="border-t-0 pt-0 pb-3">
        <button
          type="button"
          className="flex w-full items-start gap-2 text-left text-xs text-slate-300"
          onClick={onToggle}
        >
          {expanded ? (
            <ChevronDown className="mt-0.5 size-4 shrink-0 text-slate-500" />
          ) : (
            <ChevronRight className="mt-0.5 size-4 shrink-0 text-slate-500" />
          )}
          <span className="flex flex-1 flex-wrap items-center gap-2">
            <span className="font-medium text-slate-200">{title}</span>
            {isPostMatch && !row.postMatchReview?.generated ? (
              <Badge variant="outline" className="text-[10px]">
                generar al abrir
              </Badge>
            ) : null}
            {row.postMatchReview?.stale ? (
              <Badge variant="destructive" className="text-[10px]">
                resultado actualizado
              </Badge>
            ) : null}
          </span>
        </button>

        {!expanded && previewText ? (
          <p className="mt-1 ml-6 line-clamp-2 text-xs leading-relaxed text-slate-500">
            {previewText}
          </p>
        ) : null}

        {expanded ? (
          <div className="mt-2 ml-6 space-y-3 border-l-2 border-amber-500/40 pl-3">
            {fullReasoning ? (
              <div>
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Predicción previa
                </p>
                <MarkdownContent className="text-xs leading-relaxed text-slate-300">
                  {fullReasoning}
                </MarkdownContent>
              </div>
            ) : null}

            {isPostMatch ? (
              <div>
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Auditoría post-partido
                </p>
                {reviewState?.loading ? (
                  <p className={adminMuted}>La IA está analizando el error…</p>
                ) : null}
                {reviewState?.error ? (
                  <p className="text-xs text-red-400">{reviewState.error}</p>
                ) : null}
                {review?.analysis ? (
                  <MarkdownContent className="text-sm text-slate-300">{review.analysis}</MarkdownContent>
                ) : null}
                {!reviewState?.loading && !review?.analysis && !reviewState?.error ? (
                  <p className={adminMuted}>Sin análisis todavía.</p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className={adminBtnOutline}
                    disabled={reviewState?.loading}
                    onClick={onRefreshReview}
                  >
                    {reviewState?.loading ? '…' : 'Regenerar análisis'}
                  </Button>
                  {review?.generatedAt ? (
                    <span className="self-center text-[11px] text-slate-500">
                      {formatKickoff(review.generatedAt)}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : fullReasoning ? null : (
              <p className={adminMuted}>Sin razonamiento guardado.</p>
            )}
          </div>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

export default function AdminAiCompetitorPage() {
  const [activeTab, setActiveTab] = useState('resumen');
  const [matchNumber, setMatchNumber] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [predictionFilter, setPredictionFilter] = useState('all');
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const [selectedLogId, setSelectedLogId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [correctedReasoning, setCorrectedReasoning] = useState('');
  const [notesBusy, setNotesBusy] = useState(false);
  const [simulateBusyId, setSimulateBusyId] = useState(null);
  const [runOfficialBusyId, setRunOfficialBusyId] = useState(null);
  const [editHome, setEditHome] = useState('0');
  const [editAway, setEditAway] = useState('0');
  const [savePredBusy, setSavePredBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [expandedInsightIds, setExpandedInsightIds] = useState(() => new Set());
  const [reviewsByMatchId, setReviewsByMatchId] = useState({});
  const detailRef = useRef(null);

  const filterDeps = [matchNumber, statusFilter, groupFilter, predictionFilter];

  const fetchOverview = useCallback(() => {
    const params = { predictionFilter };
    if (matchNumber.trim()) params.matchNumber = matchNumber.trim();
    if (statusFilter) params.status = statusFilter;
    if (groupFilter) params.group = groupFilter;
    return adminApi.getAiCompetitorOverview(params);
  }, filterDeps);

  const { data, loading, error, refresh } = useLiveData(fetchOverview, filterDeps, {
    memoryCacheKey: `ai-overview:${filterDeps.join(':')}`,
    memoryCacheTtlMs: 30_000,
    realtimeDebounceMs: 750,
  });

  const overviewReady = !loading && data !== null;

  const fetchAnalytics = useCallback(() => adminApi.getAiAnalytics({ year: 2026 }), []);
  const {
    data: analyticsData,
    loading: analyticsLoading,
    error: analyticsError,
    refresh: refreshAnalytics,
  } = useLiveData(fetchAnalytics, []);

  const refreshAll = useCallback(() => {
    refresh();
    refreshAnalytics();
  }, [refresh, refreshAnalytics]);

  const stats = data?.stats ?? null;
  const matches = data?.matches ?? [];

  useEffect(() => {
    if (!selectedLogId) {
      setDetail(null);
      setNotes('');
      setCorrectedReasoning('');
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
        setCorrectedReasoning(payload.correctedReasoning ?? '');
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

  const selectedRow = matches.find((m) => m.matchId === selectedMatchId) ?? null;

  const loadPostMatchReview = useCallback(async (matchId, { forceRefresh = false } = {}) => {
    setReviewsByMatchId((prev) => ({
      ...prev,
      [matchId]: { ...prev[matchId], loading: true, error: null },
    }));
    try {
      const data = await adminApi.getAiPostMatchReview(matchId, { refresh: forceRefresh });
      setReviewsByMatchId((prev) => ({
        ...prev,
        [matchId]: { loading: false, data, error: null },
      }));
      if (forceRefresh) refreshAll();
    } catch (err) {
      setReviewsByMatchId((prev) => ({
        ...prev,
        [matchId]: { loading: false, error: err.message },
      }));
    }
  }, [refreshAll]);

  function toggleMatchInsight(row, event) {
    event?.stopPropagation();
    const { matchId } = row;
    const willExpand = !expandedInsightIds.has(matchId);
    setExpandedInsightIds((prev) => {
      const next = new Set(prev);
      if (willExpand) next.add(matchId);
      else next.delete(matchId);
      return next;
    });
    if (willExpand && row.postMatchReview?.available && !reviewsByMatchId[matchId]?.data) {
      void loadPostMatchReview(matchId);
    }
  }

  useEffect(() => {
    if (!selectedRow) {
      setEditHome('0');
      setEditAway('0');
      return;
    }
    const p = selectedRow.prediction;
    if (p?.userSubmitted) {
      setEditHome(String(p.homeGoals));
      setEditAway(String(p.awayGoals));
      return;
    }
    if (
      selectedRow.predictionState === 'faltante' &&
      matchHasFinalScore(selectedRow.match) &&
      selectedRow.match?.homeScore != null &&
      selectedRow.match?.awayScore != null
    ) {
      setEditHome(String(selectedRow.match.homeScore));
      setEditAway(String(selectedRow.match.awayScore));
      return;
    }
    setEditHome(String(p?.homeGoals ?? 0));
    setEditAway(String(p?.awayGoals ?? 0));
  }, [
    selectedMatchId,
    selectedRow?.predictionState,
    selectedRow?.prediction?.homeGoals,
    selectedRow?.prediction?.awayGoals,
    selectedRow?.prediction?.userSubmitted,
    selectedRow?.match?.homeScore,
    selectedRow?.match?.awayScore,
  ]);

  function selectMatchRow(row, { scroll = false } = {}) {
    setSelectedMatchId(row.matchId);
    setSelectedLogId(row.latestLogId);
    if (scroll) {
      requestAnimationFrame(() => {
        detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }

  async function upsertAiPredictionForRow(row, homeGoals, awayGoals, successMessage) {
    setSavePredBusy(true);
    setMessage('');
    try {
      await adminApi.upsertAiCompetitorPrediction(row.matchId, { homeGoals, awayGoals });
      setSelectedMatchId(row.matchId);
      setEditHome(String(homeGoals));
      setEditAway(String(awayGoals));
      setMessage(successMessage);
      await refreshAll();
      requestAnimationFrame(() => {
        detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSavePredBusy(false);
    }
  }

  async function loadRealScore(row, event) {
    event?.stopPropagation();
    if (!matchHasFinalScore(row.match)) return;
    if (row.match?.homeScore == null || row.match?.awayScore == null) return;
    await upsertAiPredictionForRow(
      row,
      row.match.homeScore,
      row.match.awayScore,
      'Predicción cargada con el resultado real (podés editarla abajo)'
    );
  }

  async function runOfficialAi(row, event) {
    event?.stopPropagation();
    if (!row.canSimulate) return;

    setRunOfficialBusyId(row.matchId);
    setMessage('');
    try {
      const result = await adminApi.runOfficialAiCompetitorPrediction(row.matchId);
      setSelectedMatchId(row.matchId);
      setSelectedLogId(result.id ?? row.latestOfficialLogId);
      setDetail(result);
      setNotes(result.adminNotes ?? '');
      setCorrectedReasoning(result.correctedReasoning ?? '');
      const src = result.finalResponse?.source ?? result.aiSource ?? 'ia';
      setMessage(
        `Predicción IA oficial: ${result.homeGoals}-${result.awayGoals} (${src})`
      );
      await refreshAll();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setRunOfficialBusyId(null);
    }
  }

  async function saveLearningFeedback() {
    if (!selectedLogId) return;
    setNotesBusy(true);
    setMessage('');
    try {
      const result = await adminApi.updateAiCompetitorLogNotes(selectedLogId, {
        adminNotes: notes,
        correctedReasoning,
      });
      setNotes(result.adminNotes ?? '');
      setCorrectedReasoning(result.correctedReasoning ?? '');
      setMessage('Feedback de aprendizaje guardado');
      await refreshAll();
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
      setCorrectedReasoning(result.correctedReasoning ?? '');
      setMessage('Simulación completada (no reemplaza la predicción oficial)');
      await refreshAll();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSimulateBusyId(null);
    }
  }

  async function saveAiPrediction(event) {
    event?.preventDefault();
    if (!selectedMatchId || !selectedRow) return;

    const home = Number(editHome);
    const away = Number(editAway);
    if (!Number.isFinite(home) || !Number.isFinite(away) || home < 0 || away < 0) {
      setMessage('Ingresá goles válidos (0 o más)');
      return;
    }

    await upsertAiPredictionForRow(selectedRow, home, away, 'Predicción de IA guardada');
  }

  return (
    <div className={adminPage}>
      <AdminPageHeader
        title="Predictive Modeling (IA)"
        description="Partidos del torneo, gráficos analíticos, laboratorio de entrenamiento, revisión interactiva del modelo y control del aprendizaje del bot."
      >
        <Button variant="outline" size="sm" className={adminBtnOutline} onClick={refreshAll} disabled={loading || analyticsLoading}>
          Actualizar
        </Button>
      </AdminPageHeader>

      <div className="flex flex-wrap gap-2 border-b border-slate-700/60 pb-1">
        {PAGE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              activeTab === tab.id
                ? 'bg-slate-700/80 font-medium text-slate-100'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {message ? (
        <p className={`text-sm ${message.includes('completada') || message.includes('guardadas') || message.includes('guardada') || message.includes('cargada') || message.includes('oficial:') ? 'text-emerald-400' : 'text-amber-300'}`}>
          {message}
        </p>
      ) : null}

      {activeTab === 'resumen' ? (
        <>
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
                value={stats.gdifCombinado != null ? stats.gdifCombinado.toFixed(3) : '—'}
                hint="Objetivo IA: 0.000 · menor = mejor precisión"
              />
              <AdminStatCard
                label="Acierto PA"
                value={stats.tasaAciertoPa != null ? `${stats.tasaAciertoPa}%` : '—'}
                hint={`PA ${stats.aciertos.pa} · GL ${stats.aciertos.gl} · GV ${stats.aciertos.gv} · GT ${stats.aciertos.gt}`}
              />
            </div>
          ) : null}

          <div className="mb-4">
            <AdminOracleLearningPanel onRefreshOverview={refreshAll} />
          </div>
        </>
      ) : null}

      {activeTab === 'graficos' ? (
        <AdminAiAnalyticsSection
          data={analyticsData}
          loading={analyticsLoading}
          error={analyticsError}
        />
      ) : null}

      {activeTab === 'partidos' ? (
        <>
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
          {!overviewReady ? <p className={adminMuted}>Cargando partidos…</p> : null}
          {overviewReady && !matches.length ? (
            <p className={adminMuted}>No hay partidos con los filtros actuales.</p>
          ) : null}

          {overviewReady && matches.length ? (
            <div className={adminTableWrap}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Partido</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Predicho</TableHead>
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
                      <Fragment key={row.matchId}>
                      <TableRow
                        className={active ? 'bg-slate-800/60' : 'cursor-pointer'}
                        onClick={() => selectMatchRow(row)}
                      >
                        <TableCell className="whitespace-nowrap text-xs text-slate-400">
                          {formatKickoff(row.match?.kickoffAt)}
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
                        <TableCell className="whitespace-nowrap text-xs text-slate-400">
                          {row.predictedAt ? (
                            formatKickoff(row.predictedAt)
                          ) : row.simulationAt ? (
                            <span className="text-amber-400/80" title="Solo simulación">
                              {formatKickoff(row.simulationAt)} (sim)
                            </span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {pred?.userSubmitted ? (
                            <span>
                              {pred.homeGoals}-{pred.awayGoals}
                              {pred.predictionSource === 'admin' ? (
                                <Badge className="ml-1" variant="outline">
                                  admin
                                </Badge>
                              ) : null}
                              {pred.predictionSource === 'ai' && pred.homeGoals === 0 && pred.awayGoals === 0 ? (
                                <Badge className="ml-1" variant="destructive">
                                  revisar
                                </Badge>
                              ) : null}
                            </span>
                          ) : row.latestSimulationLogId ? (
                            <span className="text-slate-400">Solo simulación</span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                          {row.simulationPrediction ? (
                            <div className="text-xs text-amber-400/90">
                              Sim {row.simulationPrediction.homeGoals}-{row.simulationPrediction.awayGoals}
                            </div>
                          ) : null}
                          {matchHasFinalScore(row.match) &&
                          row.match?.homeScore != null &&
                          row.match?.awayScore != null ? (
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
                          <div className="flex flex-wrap justify-end gap-1">
                            {row.predictionState === 'faltante' &&
                            matchHasFinalScore(row.match) &&
                            row.match?.homeScore != null &&
                            row.match?.awayScore != null ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className={adminBtnOutline}
                                disabled={savePredBusy}
                                onClick={(e) => loadRealScore(row, e)}
                              >
                                Cargar real
                              </Button>
                            ) : null}
                            <Button
                              size="sm"
                              variant="outline"
                              className={adminBtnOutline}
                              onClick={(e) => {
                                e.stopPropagation();
                                selectMatchRow(row, { scroll: true });
                              }}
                            >
                              {row.predictionState === 'faltante' ? 'Cargar' : 'Editar'}
                            </Button>
                            {row.canSimulate ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className={adminBtnOutline}
                                  disabled={runOfficialBusyId === row.matchId}
                                  onClick={(e) => runOfficialAi(row, e)}
                                >
                                  {runOfficialBusyId === row.matchId ? '…' : 'IA oficial'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className={adminBtnOutline}
                                  disabled={simulateBusyId === row.matchId}
                                  onClick={(e) => simulateMatch(row, e)}
                                >
                                  {simulateBusyId === row.matchId ? '…' : 'Simular'}
                                </Button>
                              </>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                      <MatchAiInsightRow
                        row={row}
                        expanded={expandedInsightIds.has(row.matchId)}
                        onToggle={(event) => toggleMatchInsight(row, event)}
                        reviewState={reviewsByMatchId[row.matchId]}
                        onRefreshReview={() => loadPostMatchReview(row.matchId, { forceRefresh: true })}
                      />
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </AdminCard>

        {selectedMatchId ? (
          <div ref={detailRef}>
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

            <div className="mb-4 rounded-lg border border-slate-700/60 bg-slate-900/40 p-3">
              <h3 className="mb-2 text-sm font-medium text-slate-200">Predicción oficial del bot</h3>
              {selectedRow?.predictionState === 'faltante' ? (
                <p className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  Sin predicción registrada (el usuario IA puede haberse creado después de este partido).
                  Cargá un marcador abajo o usá el resultado real; luego podés ajustarlo.
                </p>
              ) : (
                <p className="mb-3 text-xs text-slate-500">
                  Corregí o agregá el marcador de Predictive Modeling. En partidos finalizados se recalculan los puntos.
                </p>
              )}
              {selectedRow?.prediction?.userSubmitted &&
              selectedRow?.prediction?.predictionSource === 'admin' &&
              selectedRow?.prediction?.homeGoals === 0 &&
              selectedRow?.prediction?.awayGoals === 0 &&
              selectedRow?.match?.status === 'upcoming' ? (
                <p className="mb-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  Esta predicción 0-0 fue cargada manualmente (admin), no por la IA. Usá «Ejecutar predicción IA
                  oficial» o «Simular» para ver qué haría el modelo.
                </p>
              ) : null}
              <form className="flex flex-wrap items-end gap-3" onSubmit={saveAiPrediction}>
                <FilterField label="Local">
                  <Input
                    type="number"
                    min={0}
                    max={20}
                    className={`w-20 ${adminInput}`}
                    value={editHome}
                    onChange={(e) => setEditHome(e.target.value)}
                    required
                  />
                </FilterField>
                <FilterField label="Visitante">
                  <Input
                    type="number"
                    min={0}
                    max={20}
                    className={`w-20 ${adminInput}`}
                    value={editAway}
                    onChange={(e) => setEditAway(e.target.value)}
                    required
                  />
                </FilterField>
                <Button type="submit" size="sm" className={adminBtnOutline} disabled={savePredBusy}>
                  {savePredBusy
                    ? 'Guardando…'
                    : selectedRow?.prediction?.userSubmitted
                      ? 'Actualizar'
                      : 'Guardar predicción'}
                </Button>
                {selectedRow?.match?.homeScore != null &&
                selectedRow?.match?.awayScore != null &&
                matchHasFinalScore(selectedRow.match) ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-amber-300 hover:text-amber-200"
                    disabled={savePredBusy}
                    onClick={() => loadRealScore(selectedRow)}
                  >
                    Usar resultado real ({selectedRow.match.homeScore}-{selectedRow.match.awayScore})
                  </Button>
                ) : null}
                {selectedRow?.canSimulate ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-sky-300 hover:text-sky-200"
                    disabled={runOfficialBusyId === selectedRow.matchId}
                    onClick={() => runOfficialAi(selectedRow)}
                  >
                    {runOfficialBusyId === selectedRow.matchId
                      ? 'Ejecutando IA…'
                      : 'Ejecutar predicción IA oficial'}
                  </Button>
                ) : null}
              </form>
              {selectedRow?.prediction?.predictionSource === 'admin' ? (
                <p className="mt-2 text-xs text-amber-400/80">Origen: corregida manualmente por admin</p>
              ) : null}
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
                {selectedRow?.predictedAt && !detail.isSimulation ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Predicción oficial: {formatKickoff(selectedRow.predictedAt)}
                  </p>
                ) : detail.isSimulation && selectedRow?.simulationAt ? (
                  <p className="mt-1 text-xs text-amber-400/80">
                    Simulación: {formatKickoff(selectedRow.simulationAt)}
                  </p>
                ) : null}
                {detail.finalResponse?.reasoning ? (
                  <MarkdownContent className="mt-2 text-sm text-slate-300">
                    {detail.finalResponse.reasoning}
                  </MarkdownContent>
                ) : null}
              </div>

              <JsonPanel title="Contexto enviado al modelo" value={detail.promptContext} />
              <JsonPanel title="Respuesta cruda (antes de calibración)" value={detail.rawResponse} />
              <JsonPanel title="Respuesta final" value={detail.finalResponse} />

              {!detail.isSimulation ? (
                <div className="space-y-4 rounded-lg border border-slate-700/60 bg-slate-900/30 p-3">
                  <h3 className="text-sm font-medium text-slate-200">Control de aprendizaje</h3>
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">
                      Razonamiento corregido (anti-alucinación)
                    </label>
                    <textarea
                      className={`${adminInput} min-h-[100px] w-full resize-y`}
                      placeholder="Escribí cómo debería haber razonado el modelo. Esto se incluye en el export de entrenamiento."
                      value={correctedReasoning}
                      onChange={(e) => setCorrectedReasoning(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">Notas internas de aprendizaje</label>
                    <textarea
                      className={`${adminInput} min-h-[100px] w-full resize-y`}
                      placeholder="Qué funcionó, qué falló, qué ajustar en prompt o datos…"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      className={adminBtnOutline}
                      onClick={saveLearningFeedback}
                      disabled={notesBusy}
                    >
                      {notesBusy ? 'Guardando…' : 'Guardar feedback'}
                    </Button>
                  </div>

                  <AdminOracleReviewChat logId={selectedLogId} disabled={detail.isSimulation} />
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
          </div>
        ) : null}
      </div>
        </>
      ) : null}
    </div>
  );
}
