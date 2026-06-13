import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card.jsx';
import { cn } from '@/lib/utils';
import { getTeamFlag } from '@/lib/teamMeta.js';
import { formatMatchDate } from '@/lib/dateFormat';
import LiveMatchPanel from './LiveMatchPanel.jsx';

function LiveMatchSummary({ match }) {
  const homeName = match?.homeTeam?.nameEn || 'Local';
  const awayName = match?.awayTeam?.nameEn || 'Visitante';
  const homeFlag = getTeamFlag(match?.homeTeam);
  const awayFlag = getTeamFlag(match?.awayTeam);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="truncate">{homeFlag} {homeName}</span>
        <span className="shrink-0 font-bold tabular-nums">
          {match?.homeScore ?? 0} - {match?.awayScore ?? 0}
        </span>
        <span className="truncate text-right">{awayName} {awayFlag}</span>
      </div>

      {match?.timeElapsed ? (
        <p className="text-xs text-red-600 dark:text-red-400">En vivo · {match.timeElapsed}</p>
      ) : null}

      {match?.prediction ? (
        <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs">
          <p className="mb-1 font-medium text-muted-foreground">Tu predicción</p>
          <p className="font-semibold tabular-nums">
            {match.prediction.homeGoals} - {match.prediction.awayGoals}
          </p>
        </div>
      ) : null}

      {match?.group ? (
        <p className="text-[11px] text-muted-foreground">
          Grupo {match.group} · {formatMatchDate(match)}
        </p>
      ) : null}
    </div>
  );
}

export default function LiveMatchShell({ match, open, onOpenChange, sideContent }) {
  const dialogRef = useRef(null);
  const homeName = match?.homeTeam?.nameEn || 'Local';
  const awayName = match?.awayTeam?.nameEn || 'Visitante';

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (open && match?.status === 'finished') {
      onOpenChange(false);
    }
  }, [open, match?.status, onOpenChange]);

  const handleClose = () => onOpenChange(false);

  if (!match) return null;

  return (
    <dialog
      ref={dialogRef}
      className={cn(
        'live-match-shell max-h-[95vh] w-[min(100%,56rem)] overflow-hidden rounded-lg border border-border bg-card p-0 shadow-lg backdrop:bg-black/50',
        'open:flex open:flex-col'
      )}
      onClose={handleClose}
      onCancel={handleClose}
    >
      <Card className="flex max-h-[95vh] flex-col border-0 shadow-none">
        <CardHeader className="flex shrink-0 flex-row items-start justify-between gap-3 space-y-0 border-b border-border/60 pb-3">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base md:text-lg">
              {homeName} vs {awayName}
            </CardTitle>
            <CardDescription>Transmisión en vivo</CardDescription>
          </div>
          <Button type="button" size="icon" variant="ghost" onClick={handleClose} aria-label="Cerrar">
            <X className="size-4" />
          </Button>
        </CardHeader>

        <CardContent className="min-h-0 flex-1 overflow-y-auto p-0">
          <div className="flex flex-col md:grid md:grid-cols-2 md:divide-x md:divide-border/60">
            <div className="sticky top-0 z-10 max-h-[40vh] shrink-0 border-b border-border/60 bg-card p-3 md:static md:max-h-none md:border-b-0 md:p-4">
              <LiveMatchPanel match={match} />
            </div>

            <div className="flex flex-col gap-4 p-4 md:max-h-[calc(95vh-5rem)] md:overflow-y-auto">
              <LiveMatchSummary match={match} />
              {sideContent}
            </div>
          </div>
        </CardContent>
      </Card>
    </dialog>
  );
}
