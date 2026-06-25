import { useCallback, useMemo, useState } from 'react';
import { matchesApi } from '@/api/client.js';
import AdminCard from '@/components/admin/AdminCard.jsx';
import AdminPageHeader from '@/components/admin/AdminPageHeader.jsx';
import MatchLineupSection, { shouldShowMatchLineup } from '@/components/lineup/MatchLineupSection.jsx';
import { adminInput, adminMuted, adminPage } from '@/components/admin/adminTheme.js';
import { logFormationPlayerMove } from '@/lib/adminFormationDebug.js';
import { useLiveData } from '@/hooks/useLiveData.js';
import { REALTIME_EVENTS } from '@/lib/realtimeSectors.js';
import { Button } from '@/components/ui/button.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';
import { cn } from '@/lib/utils';

function matchLabel(match) {
  const home = match?.homeTeam?.nameEn ?? match?.homeTeamName ?? 'Local';
  const away = match?.awayTeam?.nameEn ?? match?.awayTeamName ?? 'Visitante';
  const minute = match?.timeElapsed ?? match?.minute;
  const clock = minute ? ` · ${minute}'` : '';
  return `${home} vs ${away}${clock}`;
}

function overrideKey(side, shirtNumber, name) {
  return `${side}:${shirtNumber ?? name}`;
}

export default function AdminFormationsPage() {
  const [selectedMatchId, setSelectedMatchId] = useState('');
  const [gridOverrides, setGridOverrides] = useState({});
  const [moveLog, setMoveLog] = useState([]);

  const fetchLiveMatches = useCallback(() => matchesApi.list({ status: 'live' }), []);

  const {
    data: liveListData,
    loading: liveListLoading,
    error: liveListError,
    refresh: refreshLiveList,
  } = useLiveData(fetchLiveMatches, [], {
    memoryCacheKey: 'admin-formations:live-list',
    memoryCacheTtlMs: 15_000,
    pollIntervalMs: 15_000,
    realtimeEvents: [REALTIME_EVENTS.MATCHES_UPDATED],
  });

  const liveMatches = liveListData?.matches ?? [];

  const fetchMatchDetail = useCallback(() => {
    if (!selectedMatchId) return Promise.resolve({ match: null });
    return matchesApi.getById(selectedMatchId);
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
    setGridOverrides({});
    setMoveLog([]);
  }

  function handlePlayerGridChange(payload) {
    const key = overrideKey(payload.side, payload.shirtNumber, payload.name);
    setGridOverrides((prev) => ({
      ...prev,
      [key]: payload.to,
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
    setGridOverrides({});
    setMoveLog([]);
  }

  return (
    <div className={adminPage}>
      <AdminPageHeader
        title="Formaciones"
        description="Réplica de la cancha del ranking en vivo. Arrastrá jugadores para marcar la posición correcta; cada movimiento se registra en consola (F12) y abajo."
      />

      <AdminCard className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[14rem] flex-1">
            <label className={cn(adminMuted, 'mb-1 block text-xs')}>Partido en vivo</label>
            <Select value={selectedMatchId || undefined} onValueChange={handleSelectMatch}>
              <SelectTrigger className={adminInput}>
                <SelectValue placeholder={liveListLoading ? 'Cargando…' : 'Elegí un partido'} />
              </SelectTrigger>
              <SelectContent>
                {liveMatches.map((item) => (
                  <SelectItem key={item.id ?? item._id} value={String(item.id ?? item._id)}>
                    {matchLabel(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" variant="outline" size="sm" className={adminInput} onClick={() => refreshLiveList()}>
            Actualizar lista
          </Button>
          {selectedMatchId ? (
            <Button type="button" variant="outline" size="sm" className={adminInput} onClick={() => refreshMatch()}>
              Refrescar partido
            </Button>
          ) : null}
        </div>

        {liveListError ? <p className="text-sm text-red-400">{liveListError.message}</p> : null}
        {!liveListLoading && liveMatches.length === 0 ? (
          <p className={adminMuted}>No hay partidos en vivo ahora.</p>
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
                  <Button type="button" variant="outline" size="sm" className={adminInput} onClick={resetOverrides}>
                    Reset posiciones
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
                Arrastrá las miniaturas en la cancha. Abrí la consola del navegador (F12) para ver entradas{' '}
                <code className="text-emerald-300">[admin-formations]</code>.
              </p>

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
