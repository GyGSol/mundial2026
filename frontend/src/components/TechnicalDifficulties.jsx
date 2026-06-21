import { Button } from '@/components/ui/button.jsx';

const IMAGE_SRC = '/dificultades-tecnicas.png';

function errorDetail(error) {
  if (!error) return 'Error desconocido';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message || error.toString();
  return String(error);
}

export default function TechnicalDifficulties({
  error,
  title = 'Dificultades técnicas',
  hint,
  onRetry,
}) {
  const detail = errorDetail(error);

  return (
    <div className="game-hero-shell">
      <div className="game-hero-shell__content flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-10">
        <img
          src={IMAGE_SRC}
          alt="Dificultades técnicas — por favor aguarde"
          className="max-h-[min(50vh,360px)] w-auto max-w-full object-contain drop-shadow-[0_8px_32px_rgba(0,0,0,0.45)]"
        />
        <div className="flex w-full max-w-xl flex-col gap-3 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl [text-shadow:0_2px_24px_rgba(0,0,0,0.45)]">
            {title}
          </h1>
          <p className="game-hero-panel rounded-lg border px-4 py-3 text-left text-sm text-slate-200 shadow-sm">
            {detail}
          </p>
          {hint ? <p className="text-sm text-slate-300">{hint}</p> : null}
          {onRetry ? (
            <Button type="button" className="mx-auto" onClick={onRetry}>
              Reintentar
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
