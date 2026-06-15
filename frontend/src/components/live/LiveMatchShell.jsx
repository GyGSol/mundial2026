import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import DialogTitleWithIcon from '@/components/DialogTitleWithIcon.jsx';
import { PopupLiveIcon } from '@/components/icons/popup/index.js';
import { Button } from '@/components/ui/button.jsx';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card.jsx';
import { cn } from '@/lib/utils';
import { getTeamFlag } from '@/lib/teamMeta.js';
import { ARGENTINA_TIMEZONE, formatMatchDate, formatPredictionUpdatedAt } from '@/lib/dateFormat';
import { isMatchStreamWarmup } from '@/lib/streamWatch.js';
import { USER_STREAM_BRAND } from '@/lib/streamBrand.js';
import TeamFlag from '../TeamFlag.jsx';
import LiveMatchPanel from './LiveMatchPanel.jsx';

function FlagInline({ team }) {
  const flagUrl = getTeamFlag(team);
  if (!flagUrl) return null;
  return (
    <img
      src={flagUrl}
      alt=""
      width={20}
      height={15}
      referrerPolicy="no-referrer"
      className="inline-block size-4 shrink-0 rounded-sm border border-border/60 object-cover align-middle"
    />
  );
}

function LiveMatchSummary({ match }) {
  const homeName = match?.homeTeam?.nameEn || 'Local';
  const awayName = match?.awayTeam?.nameEn || 'Visitante';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="flex min-w-0 items-center gap-1.5 truncate">
          <FlagInline team={match?.homeTeam} />
          {homeName}
        </span>
        <span className="shrink-0 font-bold tabular-nums">
          {match?.homeScore ?? 0} - {match?.awayScore ?? 0}
        </span>
        <span className="flex min-w-0 items-center justify-end gap-1.5 truncate text-right">
          {awayName}
          <FlagInline team={match?.awayTeam} />
        </span>
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
          {match.prediction.updatedAt ? (
            <p className="mt-1 text-muted-foreground">
              Última predicción: {formatPredictionUpdatedAt(match.prediction.updatedAt)}
            </p>
          ) : null}
        </div>
      ) : null}

      {match?.group ? (
        <p className="text-[11px] text-muted-foreground">
          Grupo {match.group} · {formatMatchDate(match, { showTimezone: true, timeZone: ARGENTINA_TIMEZONE })}
        </p>
      ) : null}
    </div>
  );
}

export default function LiveMatchShell({ match, open, onOpenChange, sideContent }) {
  const dialogRef = useRef(null);
  const [theaterMode, setTheaterMode] = useState(false);
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

  useEffect(() => {
    if (!open) setTheaterMode(false);
  }, [open]);

  const handleClose = () => onOpenChange(false);

  if (!match) return null;

  const isWarmup = isMatchStreamWarmup(match);

  return (
    <dialog
      ref={dialogRef}
      className={cn(
        'live-match-shell z-[100] max-h-[min(95dvh,calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-0.5rem))]',
        'w-[min(calc(100vw-1rem),56rem)] overflow-hidden rounded-lg border border-border bg-card p-0 shadow-lg backdrop:bg-black/55',
        'open:fixed open:inset-0 open:m-auto open:flex open:flex-col',
        theaterMode && 'w-[min(calc(100vw-0.5rem),72rem)]'
      )}
      onClose={handleClose}
      onCancel={handleClose}
      aria-labelledby="live-match-title"
    >
      <Card className="flex min-h-0 max-h-[inherit] flex-col border-0 shadow-none">
        <CardHeader className="flex shrink-0 flex-row items-start justify-between gap-3 space-y-0 border-b border-border/60 pb-3">
          <div className="min-w-0 space-y-1">
            <DialogTitleWithIcon
              icon={PopupLiveIcon}
              id="live-match-title"
              titleClassName="text-base md:text-lg"
              iconLabel="¡A la cancha, en vivo!"
            >
              {homeName} vs {awayName}
            </DialogTitleWithIcon>
            <CardDescription>
              {theaterMode
                ? `Modo teatro · ${USER_STREAM_BRAND}`
                : isWarmup
                  ? `Calentamiento · ${USER_STREAM_BRAND}`
                  : 'Transmisión en vivo'}
            </CardDescription>
          </div>
          <Button type="button" size="icon" variant="ghost" onClick={handleClose} aria-label="Cerrar">
            <X className="size-4" />
          </Button>
        </CardHeader>

        <CardContent className="min-h-0 flex-1 overflow-y-auto p-0">
          <div
            className={cn(
              'flex flex-col',
              !theaterMode && 'md:grid md:grid-cols-2 md:divide-x md:divide-border/60',
              theaterMode && 'h-full'
            )}
          >
            <div
              className={cn(
                'shrink-0 border-b border-border/60 bg-card p-3',
                !theaterMode && 'md:static md:border-b-0 md:p-4',
                theaterMode && 'w-full border-b-0 p-2 sm:p-3'
              )}
            >
              <LiveMatchPanel
                match={match}
                theaterMode={theaterMode}
                onTheaterModeChange={setTheaterMode}
              />
            </div>

            {!theaterMode ? (
              <div className="flex flex-col gap-4 p-4 md:max-h-[calc(95vh-5rem)] md:overflow-y-auto">
                <LiveMatchSummary match={match} />
                {sideContent}
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </dialog>
  );
}
