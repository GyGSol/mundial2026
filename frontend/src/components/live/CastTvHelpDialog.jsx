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
              Deco Telecentro
            </DialogTitleWithIcon>
            <CardDescription>Qué significa lo que dice Chrome</CardDescription>
          </div>
          <Button type="button" size="icon" variant="ghost" onClick={handleClose} aria-label="Cerrar">
            <X className="size-4" />
          </Button>
        </CardHeader>

        <CardContent className="flex flex-col gap-4 pb-5 text-sm leading-relaxed text-muted-foreground">
          <p>
            Si Chrome muestra{' '}
            <strong className="font-medium text-foreground">
              «Disponible para sitios de video específicos»
            </strong>{' '}
            en <strong className="font-medium text-foreground">Telecentro-3a</strong>, el deco{' '}
            <strong className="font-medium text-foreground">no acepta</strong> esta web ni otras páginas
            arbitrarias. Solo apps y sitios acordados (YouTube, Netflix, Disney+, etc.).
          </p>
          <p>
            Por eso YouTube sí te deja mandar el video al deco y{' '}
            <strong className="font-medium text-foreground">Mundial 2026 no</strong>: no es un fallo de
            la app ni de tu cuenta Google en el TV.
          </p>

          <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
            <p className="mb-2 font-medium text-foreground">Si en la lista ves «Smart TV — Disponible»</p>
            <p>
              Ese equipo sí suele aceptar{' '}
              <strong className="font-medium text-foreground">Transmitir pestaña</strong>: menú{' '}
              <strong className="font-medium text-foreground">⋮</strong> → Guardar y compartir → Transmitir →
              Smart TV → Pestaña con el partido abierto acá.
            </p>
          </div>

          <div>
            <p className="mb-2 font-medium text-foreground">Otras opciones con deco Telecentro</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Cable HDMI de la PC o notebook al televisor.</li>
              <li>Ver el partido por el canal oficial en el deco (TNT Sports, etc.).</li>
              <li>Seguir en el celu o en la PC sin castear al deco.</li>
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
