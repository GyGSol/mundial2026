import { useEffect, useRef, useState } from 'react';
import { Loader2, RefreshCw, SendHorizontal, Sparkles } from 'lucide-react';
import { PopupFubolIcon } from '@/components/icons/popup/index.js';
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
import MarkdownContent from './MarkdownContent.jsx';
import PlayerAvatar from './PlayerAvatar.jsx';
import PlayerSeasonStatsPanel from './PlayerSeasonStatsPanel.jsx';

function healthBadgeClass(status) {
  if (status === 'injured') return 'border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400';
  if (status === 'doubt') return 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400';
  if (status === 'unknown') return 'border-border bg-muted/40 text-muted-foreground';
  return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
}

/** @param {{ totals?: Record<string, number> | null }} props */
function TournamentTotalsPanel({ totals }) {
  if (!totals) return null;

  const items = [
    { label: 'PJ', value: totals.matches ?? 0 },
    { label: 'Goles', value: totals.goals ?? 0 },
    { label: 'Amarillas', value: totals.yellowCards ?? 0 },
    { label: 'Rojas', value: totals.redCards ?? 0 },
    { label: 'Faltas', value: totals.fouls ?? 0 },
    { label: 'Cambios', value: totals.substitutions ?? 0 },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-md border border-border px-3 py-2">
          <p className="text-xs text-muted-foreground">{item.label}</p>
          <p className="font-semibold tabular-nums">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

function eventIcon(type) {
  switch (type) {
    case 'goal':
      return '⚽';
    case 'yellow_card':
      return '🟨';
    case 'red_card':
      return '🟥';
    case 'foul':
      return '⚠️';
    case 'substitution':
      return '🔄';
    case 'shot_attempt':
      return '🎯';
    default:
      return '•';
  }
}

/** @param {{ matches?: Array<{ matchId?: string, label?: string, score?: string | null, status?: string, events?: Array<{ type?: string, label?: string, minute?: string, detail?: string | null }> }> } | null | undefined }} props */
function TournamentMatchesPanel({ matches }) {
  if (!matches?.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Todavía no hay acciones registradas de este jugador en el Mundial 2026.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {matches.map((match) => (
        <div key={match.matchId} className="rounded-lg border border-border bg-muted/20 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{match.label}</p>
              {match.status === 'live' ? (
                <p className="text-xs text-red-600 dark:text-red-400">En vivo</p>
              ) : null}
            </div>
            {match.score ? (
              <p className="shrink-0 text-sm font-semibold tabular-nums">{match.score}</p>
            ) : null}
          </div>
          <ul className="mt-2 space-y-1.5">
            {match.events?.map((event, index) => (
              <li
                key={`${match.matchId}-${event.type}-${event.minute}-${index}`}
                className="flex items-start gap-2 text-sm text-muted-foreground"
              >
                <span className="shrink-0" aria-hidden="true">
                  {eventIcon(event.type)}
                </span>
                <span className="min-w-0">
                  <span className="font-medium tabular-nums text-foreground">{event.minute}</span>
                  {' · '}
                  {event.label}
                  {event.detail ? ` · ${event.detail}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
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
  const [tournament, setTournament] = useState(null);
  const [loadingPlayer, setLoadingPlayer] = useState(false);
  const [loadingTournament, setLoadingTournament] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState('');
  const [question, setQuestion] = useState('');
  const [followUps, setFollowUps] = useState([]);

  const resolvedPlayerId = player?.id ?? (isMongoPlayerId(playerId) ? playerId : null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (open) return;
    setPlayer(null);
    setTournament(null);
    setError('');
    setLoadingPlayer(false);
    setLoadingTournament(false);
    setFollowUps([]);
    setQuestion('');
  }, [open]);

  useEffect(() => {
    if (!open) return;

    setPlayer(null);
    setTournament(null);
    setError('');
    setFollowUps([]);
    setQuestion('');
    setLoadingPlayer(Boolean(playerId || externalId));
    setLoadingTournament(true);

    let cancelled = false;

    const loadTournament = async (identity) => {
      try {
        const data = await playersApi.getTournamentActivity(identity);
        if (!cancelled) setTournament(data.tournament ?? null);
      } catch {
        // El torneo es secundario: si falla, mostramos vacío sin bloquear la ficha.
      } finally {
        if (!cancelled) setLoadingTournament(false);
      }
    };

    const resolvePlayer = async () => {
      const tournamentIdentity = {
        playerId: isMongoPlayerId(playerId) ? playerId : preview?.playerId ?? null,
        externalId: externalId ?? preview?.externalId ?? null,
        name: preview?.name ?? null,
        team: preview?.teamFifaCode ?? null,
      };

      void loadTournament(tournamentIdentity);

      try {
        if (playerId && isMongoPlayerId(playerId)) {
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
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'No se pudo cargar la ficha del jugador');
        }
      } finally {
        if (!cancelled) setLoadingPlayer(false);
      }
    };

    void resolvePlayer();

    return () => {
      cancelled = true;
    };
  }, [open, playerId, externalId, preview?.name, preview?.teamFifaCode, preview?.externalId, preview?.playerId]);

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
  const displayShirt = player?.shirtNumber ?? preview?.shirtNumber ?? null;

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
            {loadingPlayer && !displayPhotoUrl ? (
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
                <div className="flex items-center justify-center gap-2 sm:justify-start">
                  <PopupFubolIcon className="size-5 shrink-0" title="Ficha del crack" />
                  <CardTitle
                    id="player-detail-title"
                    className="flex flex-wrap items-center justify-center gap-2 text-xl sm:justify-start sm:text-2xl"
                  >
                    {loadingPlayer && !displayName ? (
                      <Skeleton className="h-8 w-48" />
                    ) : (
                      displayName
                    )}
                    {!loadingPlayer && player ? (
                      <Badge className="gap-1 border-violet-500/40 bg-violet-500/10 text-violet-200">
                        <Sparkles className="size-3" aria-hidden />
                        IA
                      </Badge>
                    ) : null}
                  </CardTitle>
                </div>
                {loadingPlayer && !displayName ? (
                  <Skeleton className="mx-auto mt-2 h-4 w-64 sm:mx-0" />
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    <span className="inline-flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                      {flag ? (
                        <img src={flag} alt="" className="size-5 rounded-sm object-cover" />
                      ) : null}
                      {displayTeam ? `${displayTeam} · ` : ''}
                      {displayPosition}
                      {displayShirt != null ? ` · #${displayShirt}` : ''}
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
                    disabled={refreshing || loadingPlayer}
                    onClick={handleRefreshIntel}
                    className="flex-1 gap-1.5 sm:flex-none"
                  >
                    {refreshing ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <RefreshCw className="size-4" aria-hidden />
                    )}
                    IA
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

            {loadingPlayer && playerId ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Cargando ficha completa…
              </div>
            ) : null}

            {player ? (
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

                {resolvedPlayerId ? (
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
                      disabled={asking}
                      className="flex min-h-[5rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <Button type="submit" size="sm" disabled={asking || !question.trim()} className="self-end gap-1.5">
                      {asking ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : (
                        <SendHorizontal className="size-4" aria-hidden />
                      )}
                      Preguntar
                    </Button>
                  </form>
                ) : null}
              </>
            ) : null}

            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <h3 className="text-sm font-medium">Mundial 2026</h3>
              {loadingTournament ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Cargando acciones del torneo…
                </div>
              ) : (
                <TournamentTotalsPanel totals={tournament?.totals} />
              )}
            </div>

            {!loadingTournament ? (
              <div className="flex flex-col gap-2 border-t border-border pt-4">
                <h3 className="text-sm font-medium">Acciones en el torneo</h3>
                <TournamentMatchesPanel matches={tournament?.matches} />
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </dialog>
  );
}
