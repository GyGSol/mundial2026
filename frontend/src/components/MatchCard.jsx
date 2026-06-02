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
import { formatMatchDate } from '@/lib/dateFormat';
import MatchScheduleBadge from '@/components/MatchScheduleBadge.jsx';

const statusLabels = {
  upcoming: { text: 'Próximo', variant: 'secondary' },
  live: { text: 'En vivo', variant: 'outline' },
  finished: { text: 'Finalizado', variant: 'default' },
};

export default function MatchCard({ match, onSave, savingId, isScheduled, onScheduled }) {
  const status = statusLabels[match.status] || statusLabels.upcoming;
  const hasPrediction = match.hasPrediction || Boolean(match.prediction);
  const isArgentinaMatch = matchInvolvesArgentina(match);
  const matchMeta = (
    <>
      Grupo {match.group} · {formatMatchDate(match)}
    </>
  );

  const headerBadges = (
    <>
      {match.status !== 'upcoming' && (
        <Badge variant={status.variant}>{status.text}</Badge>
      )}
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
    </>
  );

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
        <div className="flex flex-col gap-2 md:hidden">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{headerBadges}</div>
            {onScheduled ? (
              <MatchScheduleBadge
                match={match}
                isScheduled={isScheduled}
                onScheduled={onScheduled}
              />
            ) : null}
          </div>
          <CardDescription className="w-full text-center">{matchMeta}</CardDescription>
        </div>

        <div className="hidden flex-wrap items-start justify-between gap-2 md:flex">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{headerBadges}</div>
          <CardDescription className="shrink-0 text-right">{matchMeta}</CardDescription>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-2">
        <PredictionForm
          match={match}
          onSave={onSave}
          saving={savingId === match.id}
          broadcasters={match.broadcasters}
        />
      </CardContent>
    </Card>
  );
}
