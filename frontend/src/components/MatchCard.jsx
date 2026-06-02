import PredictionForm from './PredictionForm.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card.jsx';
import { cn } from '@/lib/utils';
import { matchInvolvesArgentina } from '@/lib/teamMeta';
import { formatMatchDate, formatLockHint } from '@/lib/dateFormat';
import BroadcastBadges from '@/components/BroadcastBadges.jsx';

const statusLabels = {
  upcoming: { text: 'Próximo', variant: 'secondary' },
  live: { text: 'En vivo', variant: 'outline' },
  finished: { text: 'Finalizado', variant: 'default' },
};

export default function MatchCard({ match, onSave, savingId }) {
  const status = statusLabels[match.status] || statusLabels.upcoming;
  const hasPrediction = match.hasPrediction || Boolean(match.prediction);
  const isArgentinaMatch = matchInvolvesArgentina(match);
  const lockHint = formatLockHint(match);

  return (
    <Card
      className={cn(
        'transition-colors',
        isArgentinaMatch &&
          'border-sky-300/80 bg-sky-50/95 shadow-sm ring-1 ring-sky-200/90',
        !isArgentinaMatch &&
          hasPrediction &&
          'border-amber-200/80 bg-amber-50/90 shadow-sm ring-1 ring-amber-100/90',
        isArgentinaMatch &&
          hasPrediction &&
          'ring-amber-200/60'
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={status.variant}>{status.text}</Badge>
            {isArgentinaMatch && (
              <Badge
                variant="outline"
                className="border-sky-400/70 bg-sky-100/70 text-sky-900"
              >
                🇦🇷 Argentina
              </Badge>
            )}
            {hasPrediction && (
              <Badge
                variant="outline"
                className={cn(
                  'border-amber-300/80 bg-amber-100/60 text-amber-900',
                  isArgentinaMatch && 'border-amber-300/60 bg-amber-50/80'
                )}
              >
                Predicción cargada
              </Badge>
            )}
          </div>
          <CardDescription className="flex flex-col items-end gap-1">
            <span>Grupo {match.group} · {formatMatchDate(match)}</span>
            <BroadcastBadges broadcasters={match.broadcasters} />
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-2">
        {lockHint && match.predictionOpen && (
          <p className="text-xs text-muted-foreground">{lockHint}</p>
        )}
        <PredictionForm match={match} onSave={onSave} saving={savingId === match.id} />
      </CardContent>
    </Card>
  );
}
