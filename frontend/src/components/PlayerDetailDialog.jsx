import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { playersApi } from '../api/client.js';
import { getTeamFlag } from '../lib/teamMeta.js';
import { isMongoPlayerId } from '../lib/playerPositionLabel.js';
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

/** @param {{ preview?: Record<string, unknown> | null }} props */
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
}) {
  const dialogRef = useRef(null);
  const [player, setPlayer] = useState(null);
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
    setLoading(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    setPlayer(null);
    setTournament(null);
    setError('');
    setLoading(true);

    let cancelled = false;

    const loadTournamentOnly = async (identity) => {
      const data = await playersApi.getTournamentActivity(identity);
      if (!cancelled) setTournament(data.tournament ?? null);
    };

    const resolvePlayer = async () => {
      try {
        if (playerId && isMongoPlayerId(playerId)) {
          const data = await playersApi.get(playerId);
          if (!cancelled) {
            setPlayer(data.player);
            setTournament(data.tournament ?? null);
          }
          return;
        }

        if (externalId) {
          const data = await playersApi.getByExternal(externalId);
          if (!cancelled) {
            setPlayer(data.player);
            setTournament(data.tournament ?? null);
          }
          return;
        }

        if (preview?.name) {
          await loadTournamentOnly({
            name: preview.name,
            team: preview.teamFifaCode,
            externalId: preview.externalId,
            playerId: preview.playerId,
          });
          return;
        }

        throw new Error('Jugador no encontrado');
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

            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Cargando datos del Mundial 2026…
              </div>
            ) : null}

            {!loading && !player && preview ? <PreviewStatsPanel preview={preview} /> : null}

            {!loading ? (
              <>
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium">Mundial 2026</h3>
                  <TournamentTotalsPanel totals={tournament?.totals} />
                </div>

                <div className="flex flex-col gap-2 border-t border-border pt-4">
                  <h3 className="text-sm font-medium">Acciones en el torneo</h3>
                  <TournamentMatchesPanel matches={tournament?.matches} />
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </dialog>
  );
}
