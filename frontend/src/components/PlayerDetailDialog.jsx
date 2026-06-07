import { useEffect, useRef, useState } from 'react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table.jsx';
import { cn } from '@/lib/utils';

function healthBadgeClass(status) {
  if (status === 'injured') return 'border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400';
  if (status === 'doubt') return 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400';
  return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
}

export default function PlayerDetailDialog({ playerId, open, onOpenChange }) {
  const dialogRef = useRef(null);
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open || !playerId) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    playersApi
      .get(playerId)
      .then((data) => {
        if (!cancelled) setPlayer(data.player);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, playerId]);

  const handleClose = () => onOpenChange(false);
  const flag = player ? getTeamFlag({ fifaCode: player.fifaCode, flag: player.flag }) : null;

  return (
    <dialog
      ref={dialogRef}
      className="max-h-[90vh] w-[min(100%,42rem)] overflow-y-auto rounded-lg border border-border bg-card p-0 text-card-foreground shadow-lg backdrop:bg-black/40"
      onClose={handleClose}
      onCancel={handleClose}
    >
      <Card className="border-0 shadow-none">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <CardTitle className="text-xl">
              {loading ? <Skeleton className="h-7 w-48" /> : player?.fullName}
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
                  {player?.currentClub ? ` · ${player.currentClub}` : ''}
                  {player?.age ? ` · ${player.age} años` : ''}
                </span>
              )}
            </CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handleClose}>
            Cerrar
          </Button>
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
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">Estado físico</span>
                <Badge className={cn(healthBadgeClass(player.healthStatus))}>
                  {player.healthLabel}
                </Badge>
                {player.isStarter ? (
                  <Badge variant="default">Titular</Badge>
                ) : null}
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

              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">Partidos recientes</h3>
                {player.recentMatches?.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Partido</TableHead>
                        <TableHead>Resultado</TableHead>
                        <TableHead>Competición</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {player.recentMatches.map((m, i) => (
                        <TableRow key={`${m.date}-${i}`}>
                          <TableCell>{m.date || '—'}</TableCell>
                          <TableCell>{m.opponent}</TableCell>
                          <TableCell>{m.result}</TableCell>
                          <TableCell className="text-muted-foreground">{m.competition || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Sin historial reciente cargado. Se actualiza con Football-Data.org cuando hay token
                    configurado.
                  </p>
                )}
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </dialog>
  );
}
