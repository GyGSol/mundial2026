import { useEffect, useRef } from 'react';
import { Cast, X } from 'lucide-react';
import DialogTitleWithIcon from '@/components/DialogTitleWithIcon.jsx';
import { Button } from '@/components/ui/button.jsx';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card.jsx';

export default function CastTvHelpDialog({ open, onOpenChange }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  const handleClose = () => onOpenChange(false);

  return (
    <dialog
      ref={dialogRef}
      className="z-[100] max-h-[90vh] w-[min(100%,28rem)] overflow-y-auto rounded-lg border border-border bg-card p-0 text-card-foreground shadow-lg backdrop:bg-black/55 open:fixed open:inset-0 open:m-auto"
      onClose={handleClose}
      onCancel={handleClose}
      aria-labelledby="cast-tv-help-title"
    >
      <Card className="border-0 shadow-none">
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
          <div className="space-y-1">
            <DialogTitleWithIcon
              icon={Cast}
              id="cast-tv-help-title"
              titleClassName="text-base"
              iconLabel="Transmitir al televisor"
            >
              Deco Telecentro u otro TV
            </DialogTitleWithIcon>
            <CardDescription>Si no aparece en la lista de «Transmitir»</CardDescription>
          </div>
          <Button type="button" size="icon" variant="ghost" onClick={handleClose} aria-label="Cerrar">
            <X className="size-4" />
          </Button>
        </CardHeader>

        <CardContent className="flex flex-col gap-4 pb-5 text-sm leading-relaxed text-muted-foreground">
          <p>
            Tener la cuenta de Google en el <strong className="font-medium text-foreground">TV</strong>{' '}
            no hace que el deco aparezca en la lista de esta web. Lo que importa es que la{' '}
            <strong className="font-medium text-foreground">PC y el deco estén en la misma WiFi</strong>{' '}
            y el deco esté encendido.
          </p>
          <p>
            YouTube lista <strong className="font-medium text-foreground">Telecentro-3a</strong> porque
            usa su propia app en el deco. Esta página usa el receptor estándar de Google; en algunos
            equipos el deco solo aparece con{' '}
            <strong className="font-medium text-foreground">Transmitir pestaña</strong> de Chrome.
          </p>

          <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
            <p className="mb-2 font-medium text-foreground">Recomendado: Transmitir pestaña</p>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>Reproducí el partido acá en Chrome.</li>
              <li>
                Menú <strong className="font-medium text-foreground">⋮</strong> (arriba a la derecha) →{' '}
                <strong className="font-medium text-foreground">Guardar y compartir</strong> →{' '}
                <strong className="font-medium text-foreground">Transmitir…</strong>
              </li>
              <li>Elegí <strong className="font-medium text-foreground">Telecentro-3a</strong> (o tu deco).</li>
              <li>
                Elegí <strong className="font-medium text-foreground">Pestaña</strong>, no «Archivo» ni
                «Pantalla».
              </li>
              <li>Confirmá que sea la pestaña con el partido.</li>
            </ol>
          </div>

          <div>
            <p className="mb-2 font-medium text-foreground">Si tampoco aparece en el menú de Chrome</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>PC y deco en la misma red (no datos del celular en el PC).</li>
              <li>
                En Chrome: configuración del sitio → permitir{' '}
                <strong className="font-medium text-foreground">acceso a la red local</strong> si lo pide.
              </li>
              <li>Probá desde el celular con Chrome en la misma WiFi.</li>
              <li>
                «Smart TV» en la lista puede ser otro aparato; el deco suele llamarse{' '}
                <strong className="font-medium text-foreground">Telecentro-…</strong>
              </li>
            </ul>
          </div>

          <Button type="button" variant="secondary" className="w-full" onClick={handleClose}>
            Entendido
          </Button>
        </CardContent>
      </Card>
    </dialog>
  );
}
