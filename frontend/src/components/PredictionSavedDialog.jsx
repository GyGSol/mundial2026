import { useEffect, useRef } from 'react';
import DialogTitleWithIcon from '@/components/DialogTitleWithIcon.jsx';
import { PopupFubolIcon } from '@/components/icons/popup/index.js';
import TeamHeader from '@/components/TeamHeader.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card.jsx';
import { ARGENTINA_TIMEZONE, formatMatchDate } from '@/lib/dateFormat.js';

function SavedScoreboard({ homeGoals, awayGoals }) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-4 py-5">
      <p className="text-center text-3xl font-bold tabular-nums text-foreground md:text-4xl">
        {homeGoals}
      </p>
      <span className="text-xl font-medium text-muted-foreground md:text-2xl">-</span>
      <p className="text-center text-3xl font-bold tabular-nums text-foreground md:text-4xl">
        {awayGoals}
      </p>
    </div>
  );
}

export default function PredictionSavedDialog({ match, homeGoals, awayGoals, open, onOpenChange }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  if (!match) return null;

  const handleClose = () => onOpenChange(false);
  const homeName = match.homeTeam?.nameEn || 'Local';
  const awayName = match.awayTeam?.nameEn || 'Visitante';
  const matchMeta = [
    match.group ? `Grupo ${match.group}` : null,
    match.knockoutPhase || null,
    formatMatchDate(match, { showTimezone: true, timeZone: ARGENTINA_TIMEZONE }),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <dialog
      ref={dialogRef}
      className="max-h-[90vh] w-[min(100%,28rem)] overflow-y-auto rounded-lg border border-border bg-card p-0 text-card-foreground shadow-lg backdrop:bg-black/40"
      onClose={handleClose}
      onCancel={handleClose}
      aria-labelledby="prediction-saved-title"
    >
      <Card className="border-0 shadow-none">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <DialogTitleWithIcon
              icon={PopupFubolIcon}
              id="prediction-saved-title"
              titleClassName="text-lg"
              iconLabel="Predicción guardada"
            >
              Predicción guardada
            </DialogTitleWithIcon>
            <CardDescription>
              {homeName} vs {awayName}
            </CardDescription>
            {matchMeta ? <p className="text-xs text-muted-foreground">{matchMeta}</p> : null}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handleClose}>
            Cerrar
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-0">
          <div className="grid grid-cols-2 gap-3">
            <TeamHeader team={match.homeTeam} slotLabel={match.homeTeamSlotLabel} />
            <TeamHeader team={match.awayTeam} slotLabel={match.awayTeamSlotLabel} />
          </div>
          <SavedScoreboard homeGoals={homeGoals} awayGoals={awayGoals} />
          <p className="text-center text-sm text-muted-foreground">Tu predicción quedó registrada.</p>
          <Button type="button" className="w-full" onClick={handleClose}>
            Entendido
          </Button>
        </CardContent>
      </Card>
    </dialog>
  );
}
