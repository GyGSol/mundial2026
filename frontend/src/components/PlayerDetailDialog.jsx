import { useEffect, useRef, useState } from 'react';
import { Loader2, RefreshCw, SendHorizontal, Sparkles } from 'lucide-react';
import { PopupPlayerIcon } from '@/components/icons/popup/index.js';
import { playersApi } from '../api/client.js';
import { getTeamFlag } from '../lib/teamMeta.js';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
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

export default function PlayerDetailDialog({ playerId, open, onOpenChange, onIntelUpdated }) {
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

  const loadPlayer = (id) => {
    setLoading(true);
    setError('');
    return playersApi
      .get(id)
      .then((data) => {
        setPlayer(data.player);
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    if (!open || !playerId) return;
    setFollowUps([]);
    setQuestion('');
    loadPlayer(playerId);
  }, [open, playerId]);

  const handleClose = () => onOpenChange(false);
  const flag = player ? getTeamFlag({ fifaCode: player.fifaCode, flag: player.flag }) : null;

  const handleRefreshIntel = async () => {
    if (!playerId || refreshing) return;
    setRefreshing(true);
    setError('');
    try {
      const data = await playersApi.refreshPlayerIntel(playerId);
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
    if (!trimmed || !playerId || asking) return;

    setAsking(true);
    setError('');
    setQuestion('');
    setFollowUps((prev) => [...prev, { role: 'user', content: trimmed }]);

    try {
      const data = await playersApi.askPlayerIntel(playerId, trimmed);
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
      className="max-h-[90vh] w-[min(100%,42rem)] overflow-y-auto rounded-lg border border-border bg-card p-0 text-card-foreground shadow-lg backdrop:bg-black/40"
      onClose={handleClose}
      onCancel={handleClose}
      aria-labelledby="player-detail-title"
    >
      <Card className="border-0 shadow-none">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-2.5">
            <PopupPlayerIcon className="mt-0.5" title="Ficha del crack" />
            <div className="flex min-w-0 flex-col gap-2">
              <CardTitle id="player-detail-title" className="flex items-center gap-2 text-xl">
                {loading ? <Skeleton className="h-7 w-48" /> : player?.fullName}
                {!loading && player ? (
                  <Badge className="gap-1 border-violet-500/40 bg-violet-500/10 text-violet-200">
                    <Sparkles className="size-3" aria-hidden />
                    IA
                  </Badge>
                ) : null}
              </CardTitle>
              <CardDescription>
              {loading ? (
                <Skeleton className="h-4 w-64" />
              ) : (
                <span className="inline-flex flex-wrap items-center gap-2">
                  {flag ? (
                    <img src={flag} alt="" className="size-5 rounded-sm object-cover" />
                  ) : null}
                  {player?.teamName} · {player?.positionLabel}
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
              )}
            </CardDescription>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={refreshing || loading}
              onClick={handleRefreshIntel}
              className="gap-1.5"
            >
              {refreshing ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="size-4" aria-hidden />
              )}
              IA
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleClose}>
              Cerrar
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          {loading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : player ? (
            <>
              <div className="flex justify-center">
                <PlayerAvatar
                  name={player.fullName}
                  photoUrl={player.photoUrl}
                  size="hero"
                  variant="portrait"
                  className="rounded-2xl border border-border bg-white shadow-sm"
                />
              </div>

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
            </>
          ) : null}
        </CardContent>
      </Card>
    </dialog>
  );
}
