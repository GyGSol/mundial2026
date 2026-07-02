import LoadingSpinner from './LoadingSpinner.jsx';
import FubolCoinIcon from './FubolCoinIcon.jsx';
import FubolsCupRankingLink from './FubolsCupRankingLink.jsx';
import FubolsCupBracket from './worldcup/FubolsCupBracket.jsx';
import { Card, CardContent } from '@/components/ui/card.jsx';

const STATUS_LABELS = {
  preview: 'Cruces proyectados',
  seeded: 'Semillas fijadas',
  running: 'En curso',
  completed: 'Finalizada',
  cancelled: 'No disputada',
};

export default function FubolsCupPanel({ data, loading, error, groupId, onRetry }) {
  if (loading) {
    return <LoadingSpinner label="Cargando Copa Fubols…" />;
  }

  if (error) {
    return (
      <p className="text-sm text-destructive">
        {error}{' '}
        {onRetry ? (
          <button type="button" className="underline" onClick={onRetry}>
            Reintentar
          </button>
        ) : null}
      </p>
    );
  }

  if (!data) return null;

  const { tournament, champion, prizes, rounds } = data;
  const status = tournament?.status ?? 'preview';
  const cancelled = status === 'cancelled';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          <p>
            Estado:{' '}
            <span className="font-medium text-foreground">{STATUS_LABELS[status] ?? status}</span>
            {champion ? ` · Campeón: ${champion.name}` : null}
          </p>
          <p className="inline-flex flex-wrap items-center gap-1">
            Premio: {prizes.championFubols} <FubolCoinIcon size="sm" /> + {prizes.trophy} · +
            {prizes.roundAdvanceFubols} <FubolCoinIcon size="sm" /> por ronda ganada
          </p>
        </div>
        <FubolsCupRankingLink groupId={groupId} disabled={cancelled} />
      </div>

      {status === 'preview' ? (
        <Card>
          <CardContent className="py-4 text-sm text-muted-foreground">
            Cruces proyectados según la tabla actual. Se fijan al terminar los dieciseisavos de
            final del Mundial.
          </CardContent>
        </Card>
      ) : null}

      {cancelled ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            Este grupo no alcanzó los 8 jugadores humanos necesarios para la Copa Fubols.
          </CardContent>
        </Card>
      ) : (
        <>
          <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            <li>Los puntos de bonificación (PB) no suman en la Copa Fubols.</li>
            <li>Cada partido del cruce se juega por separado: gana quien hace más puntos en ese partido.</li>
            <li>Si cada uno gana un partido, pasa quien tuvo mayor diferencia en el partido que ganó.</li>
            <li>Si el cruce queda igualado, gana quien tiene más puntos en el torneo.</li>
            <li>Tocá un partido del cuadro para ir a Predicciones y cargar tu pronóstico.</li>
          </ul>
          <FubolsCupBracket rounds={rounds} />
        </>
      )}
    </div>
  );
}
