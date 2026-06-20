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
import { useLiveMatchDisplayClock } from '@/hooks/useLiveMatchDisplayClock.js';
import {
  liveCardBadgeLabel,
  matchHasCreibleFinishEvidence,
  shouldKeepLiveViewerOpen,
} from '@/lib/matchStatus.js';
import TeamFlag from '../TeamFlag.jsx';
import LiveMatchPanel from './LiveMatchPanel.jsx';
import LiveMatchSwitcher from './LiveMatchSwitcher.jsx';

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
  const displayClock = useLiveMatchDisplayClock(match);
  const badge = liveCardBadgeLabel(match, { displayClock });

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

      {badge ? (
        <p
          className={cn(
            'text-xs',
            match?.status === 'live' && !badge.startsWith('Final')
              ? 'text-red-600 dark:text-red-400'
              : 'text-muted-foreground'
          )}
        >
          {badge}
        </p>
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

const CLOSE_GRACE_MS = 12_000;

export default function LiveMatchShell({
  match,
  open,
  onOpenChange,
  sideContent,
  liveMatches = [],
  onSwitchMatch,
}) {
  const dialogRef = useRef(null);
  const closeTimerRef = useRef(null);
  const [theaterMode, setTheaterMode] = useState(false);
  const [finishedBanner, setFinishedBanner] = useState(null);
  const homeName = match?.homeTeam?.nameEn || 'Local';
  const awayName = match?.awayTeam?.nameEn || 'Visitante';

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) {
      setFinishedBanner(null);
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      return undefined;
    }

    if (!match) return undefined;

    if (shouldKeepLiveViewerOpen(match)) {
      setFinishedBanner(null);
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      return undefined;
    }

    if (!matchHasCreibleFinishEvidence(match)) return undefined;

    const othersLive = liveMatches.filter((m) => m.id !== match.id);
    setFinishedBanner({
      othersLive,
    });

    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => {
      onOpenChange(false);
    }, CLOSE_GRACE_MS);

    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [open, match, liveMatches, onOpenChange]);

  useEffect(() => {
    if (!open) setTheaterMode(false);
  }, [open]);

  const handleClose = () => onOpenChange(false);

  if (!match) return null;

  const isWarmup = isMatchStreamWarmup(match);
  const switcherMatches = liveMatches.length > 0 ? liveMatches : [match];

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
          <div className="min-w-0 flex-1 space-y-2">
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
            {onSwitchMatch ? (
              <LiveMatchSwitcher
                matches={switcherMatches}
                activeMatchId={match.id}
                onSelect={onSwitchMatch}
              />
            ) : null}
          </div>
          <Button type="button" size="icon" variant="ghost" onClick={handleClose} aria-label="Cerrar">
            <X className="size-4" />
          </Button>
        </CardHeader>

        {finishedBanner ? (
          <div className="border-b border-emerald-300/40 bg-emerald-50/90 px-4 py-2 text-sm text-emerald-950 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-100">
            <p className="font-medium">Partido finalizado</p>
            {finishedBanner.othersLive.length > 0 && onSwitchMatch ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {finishedBanner.othersLive.map((other) => (
                  <Button
                    key={other.id}
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onSwitchMatch(other.id)}
                  >
                    Ver {other.homeTeam?.nameEn ?? 'Local'} vs {other.awayTeam?.nameEn ?? 'Visitante'}
                  </Button>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">El visor se cerrará en unos segundos.</p>
            )}
          </div>
        ) : null}

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
