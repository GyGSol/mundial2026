import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminApi } from '@/api/adminClient.js';
import { leaderboardApi, matchesApi } from '@/api/client.js';
import AdminCard from '@/components/admin/AdminCard.jsx';
import AdminPageHeader from '@/components/admin/AdminPageHeader.jsx';
import MatchLineupSection, { shouldShowMatchLineup } from '@/components/lineup/MatchLineupSection.jsx';
import { adminInput, adminMuted, adminPage } from '@/components/admin/adminTheme.js';
import { logFormationPlayerMove, formationOverrideKey } from '@/lib/adminFormationDebug.js';
import { ARGENTINA_TIMEZONE, formatMatchDate } from '@/lib/dateFormat.js';
import { findNextUpcomingMatches } from '@/lib/nextLockedMatch.js';
import { useLiveData } from '@/hooks/useLiveData.js';
import { REALTIME_EVENTS } from '@/lib/realtimeSectors.js';
import { Button } from '@/components/ui/button.jsx';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';
import { cn } from '@/lib/utils';

function matchId(match) {
  return String(match?.id ?? match?._id ?? '');
}

function matchLabel(match) {
  const home = match?.homeTeam?.nameEn ?? match?.homeTeamName ?? 'Local';
  const away = match?.awayTeam?.nameEn ?? match?.awayTeamName ?? 'Visitante';
  if (match?.status === 'finished') {
    const homeScore = match.homeScore ?? '–';
    const awayScore = match.awayScore ?? '–';
    return `${home} vs ${away} · Final ${homeScore}–${awayScore}`;
  }
  if (match?.status === 'upcoming') {
    const when = match.kickoffAt
      ? formatMatchDate(match, { showTimezone: false, timeZone: ARGENTINA_TIMEZONE })
      : '';
    return `${home} vs ${away}${when ? ` · ${when}` : ''} · Próximo`;
  }
  const minute = match?.timeElapsed ?? match?.minute;
  const clock = minute ? ` · ${minute}'` : '';
  return `${home} vs ${away}${clock} · En vivo`;
}

async function fetchFormationMatchList() {
  const [snapshot, archive, upcomingRes] = await Promise.all([
    matchesApi.liveSnapshot(),
    leaderboardApi.finishedArchive(),
    matchesApi.list({ status: 'upcoming' }),
  ]);
  const liveMatches = snapshot?.liveMatches ?? [];
  const liveIds = new Set(liveMatches.map(matchId));
  const recentFinished = (snapshot?.recentFinishedMatches ?? []).filter(
    (item) => !liveIds.has(matchId(item))
  );
  const finishedById = new Map(recentFinished.map((item) => [matchId(item), item]));
  for (const item of archive?.finishedMatches ?? []) {
    const id = matchId(item);
    if (!liveIds.has(id)) finishedById.set(id, item);
  }
  const nextUpcomingMatches = findNextUpcomingMatches(upcomingRes?.matches ?? []);
  const nextIds = new Set(nextUpcomingMatches.map(matchId));
  return {
    liveMatches,
    nextUpcomingMatches,
    finishedMatches: [...finishedById.values()].filter((item) => !nextIds.has(matchId(item))),
  };
}

async function fetchFormationMatchDetail(selectedMatchId) {
  const id = String(selectedMatchId);
  const snapshot = await matchesApi.liveSnapshot({ detailMatchId: selectedMatchId });
  const fromSnapshot =
    (snapshot?.liveMatches ?? []).find((item) => matchId(item) === id) ??
    (snapshot?.recentFinishedMatches ?? []).find((item) => matchId(item) === id);
  if (
    fromSnapshot?.lineup?.home?.players?.length ||
    fromSnapshot?.lineup?.away?.players?.length
  ) {
    return { match: fromSnapshot };
  }
  const archive = await leaderboardApi.finishedArchive();
  const fromArchive = (archive?.finishedMatches ?? []).find((item) => matchId(item) === id);
  if (
    fromArchive?.lineup?.home?.players?.length ||
    fromArchive?.lineup?.away?.players?.length
  ) {
    return { match: fromArchive };
  }
  try {
    const detail = await matchesApi.getById(selectedMatchId);
    if (detail?.match) return { match: detail.match };
  } catch {
    // upcoming sin detalle o partido inexistente
  }
  return { match: fromArchive ?? fromSnapshot ?? null };
}

function overrideKey(side, shirtNumber, name) {
  return formationOverrideKey(side, shirtNumber, name) ?? '';
}

export default function AdminFormationsPage() {
  const [selectedMatchId, setSelectedMatchId] = useState('');
  const [gridOverrides, setGridOverrides] = useState({});
  const [moveLog, setMoveLog] = useState([]);
  const [savedOverrideMeta, setSavedOverrideMeta] = useState(null);
  const [overridesLoading, setOverridesLoading] = useState(false);
  const [saveState, setSaveState] = useState({ status: 'idle', message: null });

  const fetchMatchList = useCallback(() => fetchFormationMatchList(), []);

  const {
    data: matchListData,
    loading: matchListLoading,
    error: matchListError,
    refresh: refreshMatchList,
  } = useLiveData(fetchMatchList, [], {
    memoryCacheKey: 'admin-formations:match-list',
    memoryCacheTtlMs: 15_000,
    pollIntervalMs: 15_000,
    realtimeEvents: [REALTIME_EVENTS.MATCHES_UPDATED],
  });

  const liveMatches = matchListData?.liveMatches ?? [];
  const nextUpcomingMatches = matchListData?.nextUpcomingMatches ?? [];
  const finishedMatches = matchListData?.finishedMatches ?? [];
  const hasSelectableMatches =
    liveMatches.length > 0 || nextUpcomingMatches.length > 0 || finishedMatches.length > 0;

  const fetchMatchDetail = useCallback(async () => {
    if (!selectedMatchId) return { match: null };
    return fetchFormationMatchDetail(selectedMatchId);
  }, [selectedMatchId]);

  const {
    data: matchDetailData,
    loading: matchLoading,
    error: matchError,
    refresh: refreshMatch,
  } = useLiveData(fetchMatchDetail, [selectedMatchId], {
    memoryCacheKey: selectedMatchId ? `admin-formations:match:${selectedMatchId}` : null,
    memoryCacheTtlMs: 10_000,
    pollIntervalMs: 10_000,
    realtimeEvents: [REALTIME_EVENTS.MATCHES_UPDATED],
    enabled: Boolean(selectedMatchId),
  });

  const match = matchDetailData?.match ?? null;

  const canShowPitch = match && shouldShowMatchLineup(match);

  const hasUnsavedChanges = useMemo(() => {
    const saved = savedOverrideMeta?.players ?? {};
    const keys = new Set([...Object.keys(saved), ...Object.keys(gridOverrides)]);
    for (const key of keys) {
      const a = saved[key];
      const b = gridOverrides[key];
      if (!a && b) return true;
      if (a && !b) return true;
      if (a && b && (a.gridX !== b.gridX || a.gridY !== b.gridY)) return true;
    }
    return false;
  }, [gridOverrides, savedOverrideMeta]);

  const loadSavedOverrides = useCallback(async (matchId) => {
    if (!matchId) {
      setSavedOverrideMeta(null);
      setGridOverrides({});
      return;
    }
    setOverridesLoading(true);
    setSaveState({ status: 'idle', message: null });
    try {
      const data = await adminApi.getFormationOverrides(matchId);
      const players = data?.players ?? {};
      setSavedOverrideMeta(data);
      setGridOverrides(
        Object.fromEntries(
          Object.entries(players).map(([key, value]) => [
            key,
            { gridX: value.gridX, gridY: value.gridY },
          ])
        )
      );
    } catch (err) {
      setSavedOverrideMeta(null);
      setGridOverrides({});
      setSaveState({
        status: 'error',
        message: err.message || 'No se pudieron cargar las posiciones guardadas.',
      });
    } finally {
      setOverridesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSavedOverrides(selectedMatchId);
  }, [selectedMatchId, loadSavedOverrides]);

  const logSummary = useMemo(
    () =>
      moveLog.map((entry) => ({
        side: entry.side,
        shirt: entry.shirtNumber,
        name: entry.name,
        from: entry.from,
        to: entry.to,
      })),
    [moveLog]
  );

  function handleSelectMatch(id) {
    setSelectedMatchId(id);
    setMoveLog([]);
    setSaveState({ status: 'idle', message: null });
  }

  function handlePlayerGridChange(payload) {
    const key = overrideKey(payload.side, payload.shirtNumber, payload.name);
    if (!key) return;
    setGridOverrides((prev) => ({
      ...prev,
      [key]: {
        gridX: payload.to.gridX,
        gridY: payload.to.gridY,
        ...(payload.shirtNumber != null && payload.shirtNumber !== ''
          ? { shirtNumber: payload.shirtNumber }
          : {}),
        ...(payload.name ? { name: payload.name } : {}),
      },
    }));

    const logEntry = logFormationPlayerMove({
      matchId: match?.id ?? match?._id ?? selectedMatchId,
      matchLabel: match ? matchLabel(match) : selectedMatchId,
      homeFormation: match?.lineup?.home?.formation ?? null,
      awayFormation: match?.lineup?.away?.formation ?? null,
      side: payload.side,
      shirtNumber: payload.shirtNumber,
      name: payload.name,
      position: payload.position,
      from: payload.from,
      to: payload.to,
      screenPercent: payload.screenPercent,
    });

    setMoveLog((prev) => [logEntry, ...prev].slice(0, 40));
  }

  async function copyLogToClipboard() {
    const text = JSON.stringify(logSummary, null, 2);
    await navigator.clipboard.writeText(text);
  }

  function resetOverrides() {
    const players = savedOverrideMeta?.players ?? {};
    setGridOverrides(
      Object.fromEntries(
        Object.entries(players).map(([key, value]) => [
          key,
          { gridX: value.gridX, gridY: value.gridY },
        ])
      )
    );
    setMoveLog([]);
    setSaveState({ status: 'idle', message: null });
  }

  async function handleSaveFormations() {
    if (!selectedMatchId) return;
    setSaveState({ status: 'saving', message: null });
    try {
      const result = await adminApi.saveFormationOverrides(selectedMatchId, gridOverrides);
      setSavedOverrideMeta(result);
      setSaveState({
        status: 'ok',
        message: `Guardado en ranking (${result.playerCount ?? Object.keys(gridOverrides).length} jugador/es).`,
      });
      await refreshMatch();
      await refreshMatchList();
    } catch (err) {
      setSaveState({
        status: 'error',
        message: err.message || 'Error al guardar formación.',
      });
    }
  }

  async function handleClearSavedFormations() {
    if (!selectedMatchId) return;
    setSaveState({ status: 'saving', message: null });
    try {
      await adminApi.clearFormationOverrides(selectedMatchId);
      setSavedOverrideMeta(null);
      setGridOverrides({});
      setMoveLog([]);
      setSaveState({ status: 'ok', message: 'Posiciones guardadas eliminadas.' });
      await refreshMatch();
      await refreshMatchList();
    } catch (err) {
      setSaveState({
        status: 'error',
        message: err.message || 'Error al borrar posiciones guardadas.',
      });
    }
  }

  return (
    <div className={adminPage}>
      <AdminPageHeader
        title="Formaciones"
        description="Réplica de la cancha del ranking. Elegí un partido, arrastrá jugadores y guardá: las posiciones se aplican en ranking para todos los usuarios."
      />

      <AdminCard className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[14rem] flex-1">
            <label className={cn(adminMuted, 'mb-1 block text-xs')}>Partido</label>
            <Select value={selectedMatchId || undefined} onValueChange={handleSelectMatch}>
              <SelectTrigger className={adminInput}>
                <SelectValue placeholder={matchListLoading ? 'Cargando…' : 'Elegí un partido'} />
              </SelectTrigger>
              <SelectContent>
                {nextUpcomingMatches.length > 0 ? (
                  <SelectGroup>
                    {nextUpcomingMatches.map((item) => (
                      <SelectItem key={matchId(item)} value={matchId(item)}>
                        {matchLabel(item)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ) : null}
                {liveMatches.length > 0 ? (
                  <SelectGroup>
                    {liveMatches.map((item) => (
                      <SelectItem key={matchId(item)} value={matchId(item)}>
                        {matchLabel(item)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ) : null}
                {finishedMatches.length > 0 ? (
                  <SelectGroup>
                    {finishedMatches.map((item) => (
                      <SelectItem key={matchId(item)} value={matchId(item)}>
                        {matchLabel(item)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ) : null}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" variant="outline" size="sm" className={adminInput} onClick={() => refreshMatchList()}>
            Actualizar lista
          </Button>
          {selectedMatchId ? (
            <Button type="button" variant="outline" size="sm" className={adminInput} onClick={() => refreshMatch()}>
              Refrescar partido
            </Button>
          ) : null}
        </div>

        {matchListError ? <p className="text-sm text-red-400">{matchListError.message}</p> : null}
        {!matchListLoading && !hasSelectableMatches ? (
          <p className={adminMuted}>No hay partidos próximos, en vivo ni finalizados disponibles.</p>
        ) : null}
        {!matchListLoading && nextUpcomingMatches.length > 0 ? (
          <p className={cn(adminMuted, 'text-xs')}>
            El próximo partido aparece arriba del listado para ajustar posiciones antes del kickoff.
          </p>
        ) : null}
        {!matchListLoading &&
        liveMatches.length === 0 &&
        nextUpcomingMatches.length === 0 &&
        finishedMatches.length > 0 ? (
          <p className={cn(adminMuted, 'text-xs')}>
            No hay partidos en vivo ni próximos; podés elegir uno finalizado del listado.
          </p>
        ) : null}
      </AdminCard>

      {selectedMatchId ? (
        <AdminCard className="space-y-4">
          {matchLoading && !match ? <p className={adminMuted}>Cargando partido…</p> : null}
          {matchError ? <p className="text-sm text-red-400">{matchError.message}</p> : null}

          {canShowPitch ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-200">{matchLabel(match)}</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="bg-emerald-600 text-white hover:bg-emerald-500"
                    disabled={!Object.keys(gridOverrides).length || saveState.status === 'saving'}
                    onClick={handleSaveFormations}
                  >
                    {saveState.status === 'saving' ? 'Guardando…' : 'Guardar formación'}
                  </Button>
                  <Button type="button" variant="outline" size="sm" className={adminInput} onClick={resetOverrides}>
                    Deshacer cambios
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={adminInput}
                    disabled={!savedOverrideMeta?.updatedAt || saveState.status === 'saving'}
                    onClick={handleClearSavedFormations}
                  >
                    Borrar guardado
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={adminInput}
                    disabled={!moveLog.length}
                    onClick={copyLogToClipboard}
                  >
                    Copiar log JSON
                  </Button>
                </div>
              </div>

              <p className={cn(adminMuted, 'text-xs')}>
                Arrastrá las miniaturas sobre la cuadrícula (snap cada 10 en gridX/gridY). «Guardar formación»
                persiste en MongoDB y actualiza el ranking. F12 sigue registrando{' '}
                <code className="text-emerald-300">[admin-formations]</code>.
              </p>

              {overridesLoading ? (
                <p className={cn(adminMuted, 'text-xs')}>Cargando posiciones guardadas…</p>
              ) : savedOverrideMeta?.updatedAt ? (
                <p className="text-xs text-emerald-300/90">
                  Guardado en prod: {new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(savedOverrideMeta.updatedAt))}
                  {hasUnsavedChanges ? ' · hay cambios sin guardar' : null}
                </p>
              ) : null}

              {saveState.message ? (
                <p
                  className={cn(
                    'text-xs',
                    saveState.status === 'error' ? 'text-red-400' : 'text-emerald-300/90'
                  )}
                >
                  {saveState.message}
                </p>
              ) : null}

              {match && !(match.lineup?.home?.players?.length || match.lineup?.away?.players?.length) ? (
                <p className="text-xs text-amber-300/90">
                  Este partido no trae jugadores en la alineación. Probá «Refrescar partido»; si persiste,
                  el sync FIFA puede estar incompleto.
                </p>
              ) : null}

              <div className="rounded-xl border border-slate-700/80 bg-slate-950/40 p-3">
                <MatchLineupSection
                  match={match}
                  mode="live"
                  showLineupMeta={false}
                  editablePitch
                  gridOverrides={gridOverrides}
                  onPlayerGridChange={handlePlayerGridChange}
                />
              </div>

              {moveLog.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Últimos movimientos ({moveLog.length})
                  </p>
                  <pre className="max-h-64 overflow-auto rounded-lg border border-slate-700 bg-slate-950 p-3 text-[10px] leading-relaxed text-emerald-100">
                    {JSON.stringify(logSummary, null, 2)}
                  </pre>
                </div>
              ) : null}
            </>
          ) : match && !matchLoading ? (
            <p className={adminMuted}>Este partido no tiene alineación ni eventos con cancha todavía.</p>
          ) : null}
        </AdminCard>
      ) : null}
    </div>
  );
}
