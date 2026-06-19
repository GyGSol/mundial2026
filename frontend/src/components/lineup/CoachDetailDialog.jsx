import { useEffect, useRef } from 'react';
import { PopupStadiumIcon } from '@/components/icons/popup/index.js';
import PlayerAvatar from '@/components/PlayerAvatar.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card.jsx';
import { getTeamFlag } from '@/lib/teamMeta.js';
import { cn } from '@/lib/utils';

export default function CoachDetailDialog({ coach, open, onOpenChange }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  if (!coach?.name) return null;

  const handleClose = () => onOpenChange(false);
  const flag = getTeamFlag({ fifaCode: coach.teamFifaCode });

  return (
    <dialog
      ref={dialogRef}
      className="max-h-[90vh] w-[min(100%,28rem)] overflow-y-auto rounded-lg border border-border bg-card p-0 text-card-foreground shadow-lg backdrop:bg-black/40"
      onClose={handleClose}
      onCancel={handleClose}
      aria-labelledby="coach-detail-title"
    >
      <Card className="border-0 shadow-none">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-2.5">
            <PopupStadiumIcon className="mt-0.5" title="Ficha del técnico" />
            <div className="flex min-w-0 flex-col gap-2">
              <CardTitle id="coach-detail-title" className="text-xl">
                {coach.name}
              </CardTitle>
              <CardDescription>
                <span className="inline-flex flex-wrap items-center gap-2">
                  {flag ? (
                    <img src={flag} alt="" className="size-5 rounded-sm object-cover" />
                  ) : null}
                  {coach.teamName ? <span>{coach.teamName}</span> : null}
                  <Badge variant="outline">Director técnico</Badge>
                </span>
              </CardDescription>
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handleClose}>
            Cerrar
          </Button>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <div className="flex justify-center">
            <PlayerAvatar
              name={coach.name}
              photoUrl={coach.photoUrl}
              size="hero"
              variant="portrait"
              className={cn(
                'rounded-2xl border border-border bg-white shadow-sm',
                coach.teamSide === 'home' ? 'ring-2 ring-sky-400/60' : 'ring-2 ring-rose-400/60'
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            {coach.nationality ? (
              <div className="rounded-md border border-border px-3 py-2">
                <p className="text-xs text-muted-foreground">Nacionalidad</p>
                <p className="font-medium">{coach.nationality}</p>
              </div>
            ) : null}
            {coach.formation ? (
              <div className="rounded-md border border-border px-3 py-2">
                <p className="text-xs text-muted-foreground">Formación</p>
                <p className="font-medium">{coach.formation}</p>
              </div>
            ) : null}
            {coach.teamName ? (
              <div
                className={cn(
                  'rounded-md border border-border px-3 py-2',
                  !coach.nationality && !coach.formation ? 'col-span-2' : ''
                )}
              >
                <p className="text-xs text-muted-foreground">Selección</p>
                <p className="font-medium">{coach.teamName}</p>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </dialog>
  );
}
