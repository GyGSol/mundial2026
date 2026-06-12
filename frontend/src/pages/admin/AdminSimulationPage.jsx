import { useCallback, useEffect, useRef, useState } from 'react';
import { adminSimulationApi } from '../../api/adminClient.js';
import LeaderboardTable from '../../components/LeaderboardTable.jsx';
import MatchPredictionRankingsTable from '../../components/MatchPredictionRankingsTable.jsx';
import AdminCard from '../../components/admin/AdminCard.jsx';
import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx';
import {
  ADMIN_BANNERS,
  adminCard,
  adminHighlight,
  adminMuted,
  adminPage,
} from '../../components/admin/adminTheme.js';
import { useLiveData } from '../../hooks/useLiveData.js';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table.jsx';
import { getTeamFlag } from '@/lib/teamMeta';
import { cn } from '@/lib/utils';
import { formatMatchDate } from '@/lib/dateFormat';

const LIVE_DELAY_MS = 800;
const BETWEEN_MATCHES_MS = 300;

const phaseLabels = {
  group: 'Fase de grupos',
  knockout: 'Fase final',
  completed: 'Campeón definido',
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatLastUpdated(date) {
  if (!date) return '';
  return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function MatchPreview({ match, highlight = false }) {
  if (!match) return null;

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-lg border px-4 py-3',
        highlight ? adminHighlight : `${adminCard} border-slate-800`
      )}
    >
      <div className={`flex flex-wrap items-center gap-2 text-xs ${adminMuted}`}>
        {match.type && match.type !== 'group' && <Badge variant="outline">{match.type}</Badge>}
        {match.crossover && <span>Cruce: {match.crossover}</span>}
        {formatMatchDate(match) && <span>{formatMatchDate(match)}</span>}
        {match.scheduleOrder != null && (
          <span>#{match.scheduleOrder + 1}</span>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <TeamLine team={match.homeTeam} />
        <div className="text-center">
          <p className="text-2xl font-semibold tabular-nums">
            {match.status === 'upcoming'
              ? 'vs'
              : `${match.homeScore} - ${match.awayScore}`}
          </p>
          <Badge variant={match.status === 'live' ? 'default' : 'secondary'}>
            {match.status === 'live' ? 'En vivo' : match.status === 'finished' ? 'Final' : 'Próximo'}
          </Badge>
        </div>
        <TeamLine team={match.awayTeam} align="right" />
      </div>
    </div>
  );
}

function TeamLine({ team, align = 'left' }) {
  const flagUrl = getTeamFlag(team);
  return (
    <div className={cn('flex min-w-[140px] items-center gap-2', align === 'right' && 'flex-row-reverse')}>
      {flagUrl ? (
        <img src={flagUrl} alt="" className="size-8 rounded-sm border border-slate-700 object-cover" />
      ) : (
        <span className="text-xl">{team?.flag || '🏳️'}</span>
      )}
      <div className={cn('flex flex-col', align === 'right' && 'items-end')}>
        <span className="font-medium">{team?.nameEn || '—'}</span>
        {team?.fifaCode && <span className={`text-xs ${adminMuted}`}>{team.fifaCode}</span>}
      </div>
    </div>
  );
}

function MatchWithRankings({ match, rankings, groupName, highlight = false }) {
  if (!match) return null;

  const showScorers = match.status === 'finished' && rankings?.some((row) => row.points > 0);
  const statusLabel =
    match.status === 'live'
      ? 'En curso'
      : match.status === 'finished'
        ? 'Finalizado'
        : 'Próximo';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Badge
          variant={
            match.status === 'live'
              ? 'default'
              : match.status === 'finished'
                ? 'secondary'
                : 'outline'
          }
        >
          {statusLabel}
        </Badge>
      </div>
      <MatchPreview match={match} highlight={highlight} />
      {showScorers && (
        <MatchPredictionRankingsTable rankings={rankings} groupName={groupName} compact />
      )}
    </div>
  );
}

export default function AdminSimulationPage() {
  const [busy, setBusy] = useState(false);
  const [autoRunning, setAutoRunning] = useState(false);
  const [activeTab, setActiveTab] = useState('summary');
  const [actionError, setActionError] = useState(null);
  const autoRunningRef = useRef(false);

  const fetchStatus = useCallback(() => adminSimulationApi.status(), []);
  const { data, loading, error, lastUpdated, refresh } = useLiveData(fetchStatus, []);

  useEffect(() => {
    autoRunningRef.current = autoRunning;
  }, [autoRunning]);

  async function runAction(action) {
    setBusy(true);
    setActionError(null);
    try {
      const result = await action();
      await refresh();
      return result;
    } catch (err) {
      setActionError(err.message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function handleSetup(mode = 'full') {
    await runAction(() =>
      adminSimulationApi.setup({
        playerCount: 10,
        matchCount: 12,
        mode,
      })
    );
  }

  async function handleStep() {
    const liveStatus = await runAction(() => adminSimulationApi.live());
    if (!liveStatus?.isLive) return;
    await sleep(LIVE_DELAY_MS);
    await runAction(() => adminSimulationApi.finish());
  }

  async function handleAutoRun() {
    if (autoRunning) {
      autoRunningRef.current = false;
      setAutoRunning(false);
      return;
    }

    setAutoRunning(true);
    autoRunningRef.current = true;
    setActiveTab('matches');
    setActionError(null);

    try {
      while (autoRunningRef.current) {
        const liveStatus = await adminSimulationApi.live();
        await refresh();
        if (!liveStatus?.isLive) break;

        await sleep(LIVE_DELAY_MS);
        if (!autoRunningRef.current) break;

        const finishedStatus = await adminSimulationApi.finish();
        await refresh();
        if (finishedStatus?.phase === 'completed') {
          break;
        }

        await sleep(BETWEEN_MATCHES_MS);
      }
    } catch (err) {
      setActionError(err.message);
    } finally {
      autoRunningRef.current = false;
      setAutoRunning(false);
    }
  }

  async function handleReset() {
    autoRunningRef.current = false;
    setAutoRunning(false);
    await runAction(() => adminSimulationApi.reset());
  }

  const progressDenominator = data?.totalPlannedMatches || data?.matchCount || 1;
  const progress = Math.round((data?.finishedCount / progressDenominator) * 100);

  return (
    <div className={adminPage}>
      <AdminPageHeader
        title="Simulación en vivo"
        description={`Simulá el mundial completo (72 grupos + 32 eliminatorias) o una demo rápida con 10 jugadores.${
          lastUpdated ? ` · Actualizado ${formatLastUpdated(lastUpdated)}` : ''
        }`}
      />

      <AdminCard banner={ADMIN_BANNERS.simulation} title="Controles">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => handleSetup('full')} disabled={busy || autoRunning}>
            Mundial completo
          </Button>
          <Button variant="outline" onClick={() => handleSetup('quick')} disabled={busy || autoRunning}>
            Demo rápida
          </Button>
          <Button variant="outline" onClick={handleStep} disabled={busy || autoRunning || !data?.active}>
            Siguiente partido
          </Button>
          <Button
            variant={autoRunning ? 'destructive' : 'secondary'}
            onClick={handleAutoRun}
            disabled={busy || !data?.active || (data?.remainingCount === 0 && !autoRunning)}
          >
            {autoRunning ? 'Detener auto-play' : 'Auto-play'}
          </Button>
          <Button variant="ghost" onClick={handleReset} disabled={busy || autoRunning}>
            Reiniciar
          </Button>
        </div>
      </AdminCard>

      {(loading || error || actionError) && (
        <div className="text-sm">
          {loading && <p className={adminMuted}>Cargando simulación...</p>}
          {error && <p className="text-red-400">{error}</p>}
          {actionError && <p className="text-red-400">{actionError}</p>}
        </div>
      )}

      {data?.active && (
        <>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={activeTab === 'summary' ? 'default' : 'outline'}
              className={cn(activeTab !== 'summary' && 'text-slate-400')}
              onClick={() => setActiveTab('summary')}
            >
              Resumen
            </Button>
            <Button
              size="sm"
              variant={activeTab === 'matches' ? 'default' : 'outline'}
              className={cn(activeTab !== 'matches' && 'text-slate-400')}
              onClick={() => setActiveTab('matches')}
            >
              Partidos
            </Button>
          </div>

          {activeTab === 'summary' && (
            <>
          <AdminCard
            header={
              <div className="flex flex-wrap items-center justify-between gap-2 text-base font-semibold">
                <span>{data.group?.name}</span>
                <div className="flex flex-wrap items-center gap-2 text-sm font-normal">
                  <Badge>{phaseLabels[data.phase] || data.phase}</Badge>
                  {data.currentKnockoutLabel ? (
                    <Badge variant="outline">{data.currentKnockoutLabel}</Badge>
                  ) : null}
                </div>
              </div>
            }
          >
            <div className="flex flex-col gap-4">
              <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <StatPill
                  label="Jugadores"
                  value={data.playerCount}
                />
                {data.mode === 'full' && (
                  <StatPill
                    label="Países"
                    value={`${data.teamsCount || 48} · 12 grupos`}
                  />
                )}
                <StatPill
                  label="Grupos"
                  value={`${data.groupFinishedCount}/${data.groupMatchCount}`}
                />
                {data.mode === 'full' && (
                  <StatPill
                    label="Eliminatorias"
                    value={`${data.knockoutFinishedCount}/${data.knockoutMatchCount}`}
                  />
                )}
              </div>

              <div>
                <div className={`mb-2 flex items-center justify-between text-xs ${adminMuted}`}>
                  <span>
                    Progreso total · {data.finishedCount}/{progressDenominator} partidos
                  </span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {data.currentRoundProgress && (
                <p className={adminMuted}>
                  Ronda actual: {data.currentRoundProgress.label} ·{' '}
                  {data.currentRoundProgress.finished}/{data.currentRoundProgress.total}
                </p>
              )}

              {data.isLive && data.liveMatch && (
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium text-amber-300">Partido en curso</p>
                  <MatchPreview match={data.liveMatch} highlight />
                </div>
              )}

              {!data.isLive && data.nextMatch && data.remainingCount > 0 && (
                <div className="flex flex-col gap-2">
                  <p className={adminMuted}>Próximo partido</p>
                  <MatchPreview match={data.nextMatch} />
                </div>
              )}

              {data.phase === 'completed' && (
                <p className="text-sm font-medium text-slate-100">
                  Simulación completa, incluida la final. Revisá la tabla final de predicciones.
                </p>
              )}
            </div>
          </AdminCard>

          {data.pendingCrossovers?.length > 0 && (
            <AdminCard title="Cruces de la ronda">
                <ul className="grid gap-2 sm:grid-cols-2">
                  {data.pendingCrossovers.map((crossover) => (
                    <li
                      key={`${crossover.round}-${crossover.crossover}`}
                      className="rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm"
                    >
                      {crossover.crossover}
                    </li>
                  ))}
                </ul>
            </AdminCard>
          )}

          {data.groupsUsed?.length > 0 && (
            <AdminCard title={`Zonas del mundial (${data.groupsUsed.length} grupos A–L)`}>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {data.groupsUsed.map((zone) => (
                  <div
                    key={zone.group}
                    className="rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm"
                  >
                    <p className="mb-1 font-medium">Zona {zone.group}</p>
                    <ul className={`flex flex-col gap-0.5 ${adminMuted}`}>
                      {zone.teams.map((team) => (
                        <li key={team.externalId}>{team.nameEn}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </AdminCard>
          )}

          {data.groupStandings?.length > 0 && (
            <AdminCard title={`Tablas de posiciones · ${data.groupStandings.length} zonas`}>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {data.groupStandings.map((group) => (
                  <div key={group.group}>
                    <p className="mb-2 text-sm font-medium">Grupo {group.group}</p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Equipo</TableHead>
                          <TableHead className="text-center">Pts</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.standings.slice(0, 4).map((row) => (
                          <TableRow key={row.teamId}>
                            <TableCell className="text-sm">{row.nameEn || row.teamId}</TableCell>
                            <TableCell className="text-center tabular-nums">{row.points}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </div>
            </AdminCard>
          )}

          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-slate-100">Ranking de predicciones (tiempo real)</h2>
            <LeaderboardTable leaderboard={data.leaderboard} />
          </div>
            </>
          )}

          {activeTab === 'matches' && (
            <div className="flex flex-col gap-4">
              <p className={adminMuted}>
                {data.mode === 'full'
                  ? `Calendario completo: ${data.scheduledMatches?.length || 0} partidos cargados · ${data.finishedCount}/${data.totalPlannedMatches} jugados · 48 países en 12 grupos.`
                  : 'Tabla por partido: solo jugadores que sumaron puntos (sin mostrar predicciones).'}
              </p>

              {data.scheduledMatches?.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {[...data.scheduledMatches].reverse().map((match) => (
                    <AdminCard key={match.id} contentClassName="pt-4">
                        <MatchWithRankings
                          match={match}
                          rankings={
                            match.status === 'finished'
                              ? data.matchPredictionRankings?.[match.externalId]
                              : undefined
                          }
                          groupName={data.predictionGroup?.name || data.group?.name}
                          highlight={match.status === 'live'}
                        />
                    </AdminCard>
                  ))}
                </div>
              ) : (
                <p className={adminMuted}>
                  Todavía no hay partidos programados. Usá Mundial completo o Auto-play.
                </p>
              )}
            </div>
          )}
        </>
      )}

      {!loading && !data?.active && (
        <p className={adminMuted}>
          Usá <strong className="text-slate-100">Mundial completo</strong> para simular 104 partidos:
          72 de grupos, cruces de dieciseisavos y toda la fase final. Con{' '}
          <strong className="text-slate-100">Auto-play</strong> ves cómo se mueve el ranking en vivo.
        </p>
      )}
    </div>
  );
}

function StatPill({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2">
      <p className={`text-xs ${adminMuted}`}>{label}</p>
      <p className="text-lg font-semibold tabular-nums text-slate-100">{value}</p>
    </div>
  );
}
