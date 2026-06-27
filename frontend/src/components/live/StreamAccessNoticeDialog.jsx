import { useEffect, useRef } from 'react';
import { ExternalLink, RefreshCw, X } from 'lucide-react';
import DialogTitleWithIcon from '@/components/DialogTitleWithIcon.jsx';
import { PopupFubolIcon } from '@/components/icons/popup/index.js';
import { Button } from '@/components/ui/button.jsx';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card.jsx';
import { isIosDevice } from '@/lib/device';
import { USER_STREAM_BRAND } from '@/lib/streamBrand.js';

const FPT_AGENDA_URL = 'https://futbolparatodos.su/agenda.php';

export default function StreamAccessNoticeDialog({
  open,
  onOpenChange,
  openUrl,
  onRetry,
}) {
  const dialogRef = useRef(null);
  const iosDevice = isIosDevice();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  const handleClose = () => onOpenChange(false);

  const handleRetry = () => {
    onOpenChange(false);
    onRetry?.();
  };

  return (
    <dialog
      ref={dialogRef}
      className="stream-access-notice z-[100] max-h-[90vh] w-[min(100%,26rem)] overflow-y-auto rounded-lg border border-border bg-card p-0 text-card-foreground shadow-lg backdrop:bg-black/55 open:fixed open:inset-0 open:m-auto"
      onClose={handleClose}
      onCancel={handleClose}
      aria-labelledby="stream-access-notice-title"
    >
      <Card className="border-0 shadow-none">
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
          <div className="space-y-1">
            <DialogTitleWithIcon
              icon={PopupFubolIcon}
              id="stream-access-notice-title"
              titleClassName="text-base"
              iconLabel="Dificultades técnicas, aguantá un cachito"
            >
              Señal interrumpida
            </DialogTitleWithIcon>
            <CardDescription>{USER_STREAM_BRAND} · restricciones por región</CardDescription>
          </div>
          <Button type="button" size="icon" variant="ghost" onClick={handleClose} aria-label="Cerrar">
            <X className="size-4" />
          </Button>
        </CardHeader>

        <CardContent className="flex flex-col gap-4 pb-5 text-sm leading-relaxed text-muted-foreground">
          <p>
            La transmisión puede arrancar y cortarse a los pocos minutos si estás{' '}
            <strong className="font-medium text-foreground">fuera de Latinoamérica</strong> (por
            ejemplo España u otras zonas de Europa).
          </p>
          <p>
            El proveedor de {USER_STREAM_BRAND} limita el acceso por{' '}
            <strong className="font-medium text-foreground">derechos de televisión</strong>. Eso lo
            decide el emisor del stream, no esta app de predicciones.
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Probá <strong className="font-medium text-foreground">Reintentar</strong> para renovar la URL de la señal.</li>
            <li>
              Abrí {USER_STREAM_BRAND} en {iosDevice ? 'Safari' : 'una pestaña nueva'} por si el reproductor
              embebido falla.
            </li>
            <li>
              Para ver el partido completo, usá un{' '}
              <strong className="font-medium text-foreground">canal oficial</strong> de tu país.
            </li>
          </ul>

          <div className="flex flex-col gap-2 pt-1">
            {openUrl ? (
              <Button type="button" className="w-full gap-2" asChild>
                <a href={openUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-4 shrink-0" aria-hidden />
                  {iosDevice ? `Abrir ${USER_STREAM_BRAND} en Safari` : `Abrir ${USER_STREAM_BRAND} en nueva pestaña`}
                </a>
              </Button>
            ) : null}
            <Button type="button" variant="outline" className="w-full gap-2" onClick={handleRetry}>
              <RefreshCw className="size-4 shrink-0" aria-hidden />
              Reintentar señal
            </Button>
            <Button type="button" variant="ghost" className="w-full gap-2" asChild>
              <a href={FPT_AGENDA_URL} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4 shrink-0" aria-hidden />
                Más opciones en {USER_STREAM_BRAND}
              </a>
            </Button>
            <Button type="button" variant="secondary" className="w-full" onClick={handleClose}>
              Entendido
            </Button>
          </div>
        </CardContent>
      </Card>
    </dialog>
  );
}
