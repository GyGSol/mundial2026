import { useEffect, useRef } from 'react';
import DialogTitleWithIcon from '@/components/DialogTitleWithIcon.jsx';
import { PopupFubolIcon } from '@/components/icons/popup/index.js';
import { Button } from '@/components/ui/button.jsx';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card.jsx';
import {
  formatStadiumLine,
  getStadiumDetailRows,
  getStadiumIconUrl,
} from '@/lib/stadiumMeta.js';

export default function StadiumDetailDialog({ stadium, open, onOpenChange }) {
  const dialogRef = useRef(null);
  const iconUrl = getStadiumIconUrl(stadium);
  const subtitle = formatStadiumLine(stadium);
  const rows = getStadiumDetailRows(stadium);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  const handleClose = () => onOpenChange(false);

  if (!stadium) return null;

  return (
    <dialog
      ref={dialogRef}
      className="max-h-[90vh] w-[min(100%,24rem)] overflow-y-auto rounded-lg border border-border bg-card p-0 text-card-foreground shadow-lg backdrop:bg-black/40"
      onClose={handleClose}
      onCancel={handleClose}
      aria-labelledby="stadium-detail-title"
    >
      <Card className="border-0 shadow-none">
        <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
          <div className="flex min-w-0 flex-1 flex-col items-center gap-3 text-center sm:items-start sm:text-left">
            {iconUrl ? (
              <img
                src={iconUrl}
                alt=""
                className="size-20 shrink-0 rounded-full border-2 border-border object-cover shadow-md ring-2 ring-background"
              />
            ) : null}
            <div className="min-w-0">
              <DialogTitleWithIcon
                icon={PopupFubolIcon}
                id="stadium-detail-title"
                titleClassName="text-lg leading-tight"
                className="justify-center sm:justify-start"
                iconLabel="Tour por la cancha"
              >
                {stadium.nameEn || 'Estadio'}
              </DialogTitleWithIcon>
              {subtitle ? (
                <CardDescription className="mt-1">{subtitle}</CardDescription>
              ) : null}
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handleClose}>
            Cerrar
          </Button>
        </CardHeader>

        <CardContent>
          <dl className="grid gap-3 text-sm">
            {rows.map((row) => (
              <div
                key={row.label}
                className="grid gap-0.5 border-b border-border/60 pb-3 last:border-0 last:pb-0"
              >
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {row.label}
                </dt>
                <dd className="text-foreground">{row.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </dialog>
  );
}
