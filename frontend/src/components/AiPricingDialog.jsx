import { useEffect, useRef } from 'react';
import { Sparkles } from 'lucide-react';
import DialogTitleWithIcon from '@/components/DialogTitleWithIcon.jsx';
import FubolCoinIcon from './FubolCoinIcon.jsx';
import { Button } from '@/components/ui/button.jsx';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from '@/components/ui/card.jsx';
import { AI_CONSULTATION_FEE, AI_QUESTIONS_PER_FEE } from '../lib/economyConstants.js';

export default function AiPricingDialog({
  open,
  onOpenChange,
  mode = 'welcome',
  onConfirm,
  confirming = false,
  creditsRemaining = 0,
}) {
  const dialogRef = useRef(null);
  const isConfirm = mode === 'confirm';

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

  return (
    <dialog
      ref={dialogRef}
      className="z-[100] max-h-[90vh] w-[min(100%,28rem)] overflow-y-auto rounded-lg border border-border bg-card p-0 text-card-foreground shadow-lg backdrop:bg-black/55 open:fixed open:inset-0 open:m-auto"
      onClose={handleClose}
      onCancel={handleClose}
      aria-labelledby="ai-pricing-title"
    >
      <Card className="border-0 shadow-none">
        <CardHeader className="pb-2">
          <DialogTitleWithIcon
            id="ai-pricing-title"
            icon={Sparkles}
            iconClassName="text-violet-300"
            title={isConfirm ? 'Confirmar consulta' : 'Consultas con IA'}
          />
          <CardDescription>
            {isConfirm
              ? 'Esta pregunta usará tu pack de consultas o descontará Fubols de tu saldo.'
              : 'La IA responde preguntas sobre partidos, grupos y clasificación. No reemplaza tu predicción de marcador.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <div className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-3">
            <p className="inline-flex flex-wrap items-center gap-1.5 font-medium text-violet-100">
              <FubolCoinIcon size="sm" />
              {AI_CONSULTATION_FEE} Fubol = {AI_QUESTIONS_PER_FEE} preguntas
            </p>
            <p className="mt-2 text-muted-foreground">
              Pagás {AI_CONSULTATION_FEE} Fubol y podés hacer hasta {AI_QUESTIONS_PER_FEE} preguntas.
              La cuarta pregunta vuelve a costar {AI_CONSULTATION_FEE} Fubol (otras {AI_QUESTIONS_PER_FEE}).
              Si estás en un grupo de competencia, esos Fubols suman al pozo del torneo y actualizan los premios.
            </p>
          </div>
          {isConfirm && creditsRemaining > 0 ? (
            <p className="text-muted-foreground">
              Te quedan <strong className="text-foreground">{creditsRemaining}</strong> pregunta
              {creditsRemaining === 1 ? '' : 's'} incluidas en tu pack actual (sin cargo extra).
            </p>
          ) : null}
          {isConfirm && creditsRemaining <= 0 ? (
            <p className="text-muted-foreground">
              No te quedan preguntas incluidas. Se descontará{' '}
              <strong className="inline-flex items-center gap-1 text-foreground">
                {AI_CONSULTATION_FEE} <FubolCoinIcon size="sm" />
              </strong>{' '}
              y podrás hacer {AI_QUESTIONS_PER_FEE} preguntas.
            </p>
          ) : null}
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={handleClose} disabled={confirming}>
            {isConfirm ? 'Cancelar' : 'Entendido'}
          </Button>
          {isConfirm ? (
            <Button type="button" onClick={onConfirm} disabled={confirming}>
              {confirming ? 'Enviando…' : 'Preguntar'}
            </Button>
          ) : null}
        </CardFooter>
      </Card>
    </dialog>
  );
}
