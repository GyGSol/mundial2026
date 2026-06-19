import { useEffect, useRef, useState } from 'react';
import { Loader2, RefreshCw, SendHorizontal, Sparkles } from 'lucide-react';
import { playersApi } from '../api/client.js';
import { getTeamFlag } from '../lib/teamMeta.js';
import { isMongoPlayerId } from '../lib/playerPositionLabel.js';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import {
  Card,
  CardContent,
  CardTitle,
} from '@/components/ui/card.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { cn } from '@/lib/utils';
import { ClubCell } from './ClubDisplay.jsx';
import PlayerAvatar from './PlayerAvatar.jsx';
import MarkdownContent from './MarkdownContent.jsx';
import PlayerSeasonStatsPanel from './PlayerSeasonStatsPanel.jsx';

function healthBadgeClass(status) {
  if (status === 'injured') return 'border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400';
  if (status === 'doubt') return 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400';
  if (status === 'unknown') return 'border-border bg-muted/40 text-muted-foreground';
  return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
}

/** @param {{ name?: string, photoUrl?: string | null, shirtNumber?: number | null, position?: string | null, tournamentGoals?: number | null, teamFifaCode?: string | null } | null | undefined} preview */
function PreviewStatsPanel({ preview }) {
  if (!preview) return null;

  return (
    <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
      <div className="rounded-md border border-border px-3 py-2">
        <p className="text-xs text-muted-foreground">Dorsal</p>
        <p className="font-semibold tabular-nums">{preview.shirtNumber ?? '—'}</p>
      </div>
      <div className="rounded-md border border-border px-3 py-2">
        <p className="text-xs text-muted-foreground">Posición</p>
        <p className="font-semibold">{preview.position ?? '—'}</p>
      </div>
      <div className="rounded-md border border-border px-3 py-2 sm:col-span-1 col-span-2">
        <p className="text-xs text-muted-foreground">Goles en el torneo</p>
        <p className="font-semibold tabular-nums">{preview.tournamentGoals ?? 0}</p>
      </div>
    </div>
  );
}

export default function PlayerDetailDialog({
  playerId,
  externalId,
  preview = null,
  open,
  onOpenChange,
  onIntelUpdated,
}) {
  const dialogRef = useRef(null);
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState('');
  const [question, setQuestion] = useState('');
  const [followUps, setFollowUps] = useState([]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (open) return;
    setPlayer(null);
    setError('');
    setLoading(false);
    setFollowUps([]);
    setQuestion('');
  }, [open]);

  useEffect(() => {
    if (!open) return;

    setFollowUps([]);
    setQuestion('');
    setPlayer(null);
    setError('');
    setLoading(true);

    let cancelled = false;

    const resolvePlayer = async () => {
      try {
        if (playerId) {
          const data = await playersApi.get(playerId);
          if (!cancelled) setPlayer(data.player);
          return;
        }

        if (externalId) {
          const data = await playersApi.getByExternal(externalId);
          if (!cancelled) setPlayer(data.player);
          return;
        }

        if (preview?.name && preview?.teamFifaCode) {
          const data = await playersApi.list({
            q: preview.name.trim(),
            team: preview.teamFifaCode,
            status: 'all',
            limit: 8,
          });
          const target = preview.name.trim().toLowerCase();
          const hit = data.players?.find(
            (row) => row.fullName?.trim().toLowerCase() === target
          );
          if (hit?.id) {
            const full = await playersApi.get(hit.id);
            if (!cancelled) setPlayer(full.player);
            return;
          }
        }

        if (!preview) {
          throw new Error('Jugador no encontrado');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'No se pudo cargar la ficha del jugador');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void resolvePlayer();

    return () => {
      cancelled = true;
    };
  }, [open, playerId, externalId, preview?.name, preview?.teamFifaCode]);

  const handleClose = () => onOpenChange(false);
  const flag = player
    ? getTeamFlag({ fifaCode: player.fifaCode, flag: player.flag })
    : preview?.teamFifaCode
      ? getTeamFlag({ fifaCode: preview.teamFifaCode })
      : null;
  const displayName = player?.fullName ?? preview?.name ?? '';
  const displayPhotoUrl = player?.photoUrl ?? preview?.photoUrl ?? '';
  const displayPosition = player?.positionLabel ?? preview?.position ?? '—';
  const displayTeam = player?.teamName ?? preview?.teamFifaCode ?? '';
  const resolvedPlayerId = player?.id ?? (isMongoPlayerId(playerId) ? playerId : null);

  const handleRefreshIntel = async () => {
    if (!resolvedPlayerId || refreshing) return;
    setRefreshing(true);
    setError('');
    try {
      const data = await playersApi.refreshPlayerIntel(resolvedPlayerId);
      setPlayer(data.player);
      onIntelUpdated?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  };

  const handleAsk = async (e) => {
    e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || !resolvedPlayerId || asking) return;

    setAsking(true);
    setError('');
    setQuestion('');
    setFollowUps((prev) => [...prev, { role: 'user', content: trimmed }]);

    try {
      const data = await playersApi.askPlayerIntel(resolvedPlayerId, trimmed);
      setFollowUps((prev) => [...prev, { role: 'assistant', content: data.reply.answer }]);
    } catch (err) {
      setError(err.message);
      setQuestion(trimmed);
      setFollowUps((prev) => prev.slice(0, -1));
    } finally {
      setAsking(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className={cn(
        // hidden + open:flex — never bare flex on <dialog> (overrides UA display:none when closed)
        'fixed m-0 hidden overflow-hidden rounded-xl border border-border bg-card p-0 text-card-foreground shadow-xl backdrop:bg-black/50 open:flex open:flex-col',
        'inset-x-2 top-[max(0.5rem,env(safe-area-inset-top))] bottom-[calc(4.75rem+env(safe-area-inset-bottom))] w-auto max-h-none',
        'sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[min(calc(100vw-2rem),42rem)] sm:max-h-[min(90dvh,calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2'
      )}
      onClose={handleClose}
      onCancel={handleClose}
      aria-labelledby="player-detail-title"
    >
      <div className="shrink-0 border-b border-border p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
          <div className="mx-auto flex shrink-0 flex-col items-center sm:mx-0">
            {loading && !displayPhotoUrl ? (
              <Skeleton className="aspect-[3/4] h-52 w-44 rounded-2xl sm:h-60 sm:w-52" />
            ) : (
              <div className="flex aspect-[3/4] h-52 w-44 items-end justify-center overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/10 sm:h-60 sm:w-52">
                <PlayerAvatar
                  name={displayName}
                  photoUrl={displayPhotoUrl}
                  size="hero"
                  variant="portrait"
                />
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 text-center sm:text-left">
                <CardTitle
                  id="player-detail-title"
                  className="flex flex-wrap items-center justify-center gap-2 text-xl sm:justify-start sm:text-2xl"
                >
                  {loading && !displayName ? (
                    <Skeleton className="h-8 w-48" />
                  ) : (
                    displayName
                  )}
                  {!loading && player ? (
                    <Badge className="gap-1 border-violet-500/40 bg-violet-500/10 text-violet-200">
                      <Sparkles className="size-3" aria-hidden />
                      IA
                    </Badge>
                  ) : null}
                </CardTitle>
                {loading && !displayName ? (
                  <Skeleton className="mx-auto mt-2 h-4 w-64 sm:mx-0" />
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    <span className="inline-flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                      {flag ? (
                        <img src={flag} alt="" className="size-5 rounded-sm object-cover" />
                      ) : null}
                      {displayTeam ? `${displayTeam} · ` : ''}
                      {displayPosition}
                      {player?.currentClub ? (
                        <>
                          {' · '}
                          <ClubCell
                            club={player.currentClub}
                            clubCrestUrl={player.clubCrestUrl}
                            leagueEmblemUrl={player.leagueEmblemUrl}
                            leagueName={player.leagueName}
                          />
                        </>
                      ) : null}
                      {player?.age ? ` · ${player.age} años` : ''}
                    </span>
                  </p>
                )}
              </div>
              <div className="flex w-full shrink-0 gap-2 sm:w-auto">
                {resolvedPlayerId ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={refreshing || loading}
                    onClick={handleRefreshIntel}
                    className="flex-1 gap-1.5 sm:flex-none"
                  >
                    {refreshing ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <RefreshCw className="size-4" aria-hidden />
                    )}
                    Actualizar IA
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleClose}
                  className="flex-1 sm:flex-none"
                >
                  Cerrar
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <Card className="border-0 shadow-none">
          <CardContent className="flex flex-col gap-4 p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-6 sm:pb-6">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          {loading && !player && preview ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Cargando ficha completa…
            </div>
          ) : null}

          {!player && preview ? <PreviewStatsPanel preview={preview} /> : null}

          {loading && !player && !preview ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : player ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">Estado físico (IA)</span>
                <Badge className={cn(healthBadgeClass(player.healthStatus))}>
                  {player.healthLabel}
                </Badge>
                {player.suspended ? <Badge variant="destructive">Suspendido</Badge> : null}
                {player.isStarter ? <Badge variant="default">Titular</Badge> : null}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <div className="rounded-md border border-border px-3 py-2">
                  <p className="text-xs text-muted-foreground">Amarillas</p>
                  <p className="font-semibold tabular-nums">{player.yellowCards ?? '—'}</p>
                </div>
                <div className="rounded-md border border-border px-3 py-2">
                  <p className="text-xs text-muted-foreground">Rojas</p>
                  <p className="font-semibold tabular-nums">{player.redCards ?? '—'}</p>
                </div>
                <div className="rounded-md border border-border px-3 py-2 sm:col-span-1 col-span-2">
                  <p className="text-xs text-muted-foreground">Actualizado IA</p>
                  <p className="font-medium">
                    {player.intelFetchedAt
                      ? new Date(player.intelFetchedAt).toLocaleString('es-AR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Sin consultar'}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 border-t border-border pt-4">
                <PlayerSeasonStatsPanel stats={player.stats} />
              </div>

              {player.wikiContext ? (
                <div className="flex flex-col gap-3 border-t border-border pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-medium">Historial (Wikipedia)</h3>
                    {player.wikiContext.url ? (
                      <a
                        href={player.wikiContext.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        Ver en Wikipedia
                      </a>
                    ) : null}
                  </div>

                  {player.wikiContext.resumen ? (
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {player.wikiContext.resumen}
                    </p>
                  ) : null}

                  <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                    <div className="rounded-md border border-border px-3 py-2">
                      <p className="text-xs text-muted-foreground">PJ selección</p>
                      <p className="font-semibold tabular-nums">
                        {player.wikiContext.seleccion?.caps ?? '—'}
                      </p>
                    </div>
                    <div className="rounded-md border border-border px-3 py-2">
                      <p className="text-xs text-muted-foreground">Goles selección</p>
                      <p className="font-semibold tabular-nums">
                        {player.wikiContext.seleccion?.goles ?? '—'}
                      </p>
                    </div>
                    <div className="rounded-md border border-border px-3 py-2 sm:col-span-1 col-span-2">
                      <p className="text-xs text-muted-foreground">Mundiales</p>
                      <p className="font-medium">
                        {(player.wikiContext.mundiales ?? [])
                          .map((row) => row.anio)
                          .join(', ') || '—'}
                      </p>
                    </div>
                  </div>

                  {(player.wikiContext.convocatorias ?? []).length > 0 ? (
                    <div className="flex flex-col gap-1">
                      <p className="text-xs font-medium text-muted-foreground">Convocatorias / torneos</p>
                      <ul className="list-inside list-disc text-sm text-muted-foreground">
                        {player.wikiContext.convocatorias.slice(0, 6).map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {(player.wikiContext.partidosRecientesSeleccion ?? []).length > 0 ? (
                    <div className="flex flex-col gap-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        Partidos recientes con la selección
                      </p>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        {player.wikiContext.partidosRecientesSeleccion.slice(0, 5).map((match) => (
                          <li key={`${match.fecha}-${match.rival}`}>
                            {match.fecha ? `${match.fecha} · ` : ''}
                            vs {match.rival}
                            {match.marcador ? ` (${match.marcador})` : ''}
                            {match.goles ? ` · ${match.goles} gol(es)` : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {player.injuryInfo ? (
                <p
                  className={cn(
                    'rounded-md border px-3 py-2 text-sm',
                    player.healthStatus === 'injured'
                      ? 'border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-300'
                      : 'border-amber-500/30 bg-amber-500/5 text-amber-800 dark:text-amber-300'
                  )}
                >
                  {player.injuryInfo}
                </p>
              ) : null}

              {player.suspensionInfo ? (
                <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {player.suspensionInfo}
                </p>
              ) : null}

              {player.aiSummary ? (
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium">Informe IA</h3>
                  <MarkdownContent className="text-sm leading-relaxed text-muted-foreground">
                    {player.aiSummary}
                  </MarkdownContent>
                </div>
              ) : player.healthStatus === 'unknown' ? (
                <p className="text-sm text-muted-foreground">
                  Todavía no hay análisis IA para este jugador. Usá el botón IA o consultá la
                  selección desde la lista.
                </p>
              ) : null}

              {followUps.length > 0 ? (
                <div className="flex max-h-40 flex-col gap-2 overflow-y-auto">
                  {[...followUps].reverse().map((entry, index) => (
                    <div
                      key={`${entry.role}-${followUps.length - index}`}
                      className={cn(
                        'rounded-lg border px-3 py-2 text-sm',
                        entry.role === 'user'
                          ? 'ml-4 border-primary/20 bg-primary/10'
                          : 'mr-4 border-border bg-muted/50'
                      )}
                    >
                      <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {entry.role === 'user' ? 'Vos' : 'IA'}
                      </p>
                      {entry.role === 'user' ? (
                        <p className="whitespace-pre-wrap">{entry.content}</p>
                      ) : (
                        <MarkdownContent className="text-sm">{entry.content}</MarkdownContent>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}

              <form onSubmit={handleAsk} className="flex flex-col gap-2 border-t border-border pt-4">
                <label htmlFor="player-ai-question" className="text-sm font-medium">
                  Repreguntar a la IA
                </label>
                <textarea
                  id="player-ai-question"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ej: ¿Llega para el próximo partido?"
                  rows={3}
                  maxLength={146}
                  disabled={asking || !resolvedPlayerId}
                  className="flex min-h-[5rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={asking || !resolvedPlayerId || !question.trim()}
                  className="self-end gap-1.5"
                >
                  {asking ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <SendHorizontal className="size-4" aria-hidden />
                  )}
                  Preguntar
                </Button>
              </form>
            </>
          ) : null}
        </CardContent>
        </Card>
      </div>
    </dialog>
  );
}
