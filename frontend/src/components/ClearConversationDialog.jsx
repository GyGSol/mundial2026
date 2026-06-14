import { useEffect, useRef } from 'react';
import { Loader2, MessageSquareOff, Sparkles, Trash2, X } from 'lucide-react';
import DialogTitleWithIcon from '@/components/DialogTitleWithIcon.jsx';
import { PopupClearIcon } from '@/components/icons/popup/index.js';
import { Button } from '@/components/ui/button.jsx';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card.jsx';

export default function ClearConversationDialog({
  open,
  onOpenChange,
  topicTitle,
  messageCount = 0,
  hasSavedPrediction = false,
  onConfirm,
  confirming = false,
}) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  const handleClose = () => {
    if (confirming) return;
    onOpenChange(false);
  };

  const handleConfirm = () => {
    onConfirm?.();
  };

  return (
    <dialog
      ref={dialogRef}
      className="z-[100] max-h-[90vh] w-[min(100%,28rem)] overflow-y-auto rounded-lg border border-border bg-card p-0 text-card-foreground shadow-lg backdrop:bg-black/55 open:fixed open:inset-0 open:m-auto"
      onClose={handleClose}
      onCancel={handleClose}
      aria-labelledby="clear-conversation-title"
    >
      <Card className="border-0 shadow-none">
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
          <div className="space-y-1">
            <DialogTitleWithIcon
              icon={PopupClearIcon}
              id="clear-conversation-title"
              titleClassName="text-base"
              iconLabel="El operador borró la pizarra"
            >
              Limpiar conversación
            </DialogTitleWithIcon>
            {topicTitle ? (
              <CardDescription className="text-foreground/80">{topicTitle}</CardDescription>
            ) : null}
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={handleClose}
            disabled={confirming}
            aria-label="Cerrar"
          >
            <X className="size-4" />
          </Button>
        </CardHeader>

        <CardContent className="flex flex-col gap-4 pb-5 text-sm leading-relaxed text-muted-foreground">
          <p>
            Vas a borrar el historial de preguntas y respuestas de esta consulta
            {messageCount > 0 ? (
              <>
                {' '}
                (<strong className="font-medium text-foreground">{messageCount}</strong>{' '}
                mensaje{messageCount === 1 ? '' : 's'} guardado{messageCount === 1 ? '' : 's'})
              </>
            ) : null}
            . La IA dejará de usar ese contexto en los próximos mensajes.
          </p>

          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-foreground">
              <MessageSquareOff className="size-3.5 shrink-0" aria-hidden />
              Se elimina
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Todas tus preguntas y las respuestas de la IA en este tema</li>
              <li>El contexto de la charla que la IA usa para seguir la conversación</li>
            </ul>
          </div>

          <div className="rounded-lg border border-violet-500/25 bg-violet-500/5 p-3">
            <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-violet-100">
              <Sparkles className="size-3.5 shrink-0" aria-hidden />
              Se mantiene
            </p>
            <ul className="list-disc space-y-1 pl-5">
              {hasSavedPrediction ? (
                <li>
                  La <strong className="font-medium text-foreground">predicción de marcador</strong>{' '}
                  guardada y su análisis
                </li>
              ) : null}
              <li>El tema de consulta (podés seguir preguntando después)</li>
              <li>Tus otras conversaciones en otros partidos o grupos</li>
            </ul>
          </div>

          <p className="text-xs">
            Esta acción no se puede deshacer. Podés volver a preguntarle a la IA cuando quieras.
          </p>

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="sm:min-w-[7.5rem]"
              onClick={handleClose}
              disabled={confirming}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="gap-2 sm:min-w-[10rem]"
              onClick={handleConfirm}
              disabled={confirming}
            >
              {confirming ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="size-4" aria-hidden />
              )}
              {confirming ? 'Limpiando…' : 'Sí, limpiar'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </dialog>
  );
}
