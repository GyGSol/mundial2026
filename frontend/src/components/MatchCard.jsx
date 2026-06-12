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
import { ARGENTINA_TIMEZONE, formatMatchDate } from '@/lib/dateFormat';
import MatchScheduleBadge from '@/components/MatchScheduleBadge.jsx';
import StadiumBadge from '@/components/StadiumBadge.jsx';

const statusLabels = {
  upcoming: { text: 'Próximo', variant: 'secondary' },
  live: { text: 'En vivo', variant: 'outline' },
  finished: { text: 'Finalizado', variant: 'default' },
};

function buildMatchMeta(match, { showPhaseInHeader, showTimezone }) {
  const parts = [];

  if (showPhaseInHeader && match.group) {
    parts.push(`Grupo ${match.group}`);
  } else if (showPhaseInHeader && match.isKnockout && match.knockoutPhase) {
    parts.push(match.knockoutPhase);
  }

  const date = formatMatchDate(match, {
    showTimezone,
    timeZone: ARGENTINA_TIMEZONE,
  });
  if (date) parts.push(date);

  return parts.join(' · ');
}

export default function MatchCard({
  match,
  onSave,
  savingId,
  isScheduled,
  onScheduled,
  showPhaseInHeader = true,
}) {
  const status = statusLabels[match.status] || statusLabels.upcoming;
  const hasPrediction = Boolean(match.hasPrediction ?? match.prediction?.userSubmitted);
  const isArgentinaMatch = matchInvolvesArgentina(match);
  const matchMeta = buildMatchMeta(match, { showPhaseInHeader, showTimezone: true });

  const headerBadges = (
    <>
      {match.status !== 'upcoming' ? (
        <Badge variant={status.variant}>{status.text}</Badge>
      ) : null}
      {isArgentinaMatch ? (
        <Badge
          variant="outline"
          className="border-sky-400/70 bg-sky-100/70 text-sky-900 max-md:border-sky-400/35 max-md:bg-sky-500/12 max-md:text-sky-100"
        >
          🇦🇷 Argentina
        </Badge>
      ) : null}
      {hasPrediction ? (
        <Badge
          variant="outline"
          className={cn(
            'border-amber-300/80 bg-amber-100/60 text-amber-900 max-md:border-amber-500/35 max-md:bg-amber-500/12 max-md:text-amber-100',
            isArgentinaMatch && 'max-md:border-amber-500/30 max-md:bg-amber-500/10'
          )}
        >
          Predicción cargada
        </Badge>
      ) : null}
    </>
  );

  const hasBadges =
    match.status !== 'upcoming' || isArgentinaMatch || hasPrediction;

  return (
    <Card
      className={cn(
        'transition-colors',
        isArgentinaMatch && [
          'shadow-sm ring-1',
          'max-md:border-sky-400/30 max-md:bg-transparent max-md:ring-sky-400/25 max-md:shadow-none',
          'md:border-sky-300/80 md:bg-sky-50/95 md:ring-sky-200/90',
        ],
        !isArgentinaMatch &&
          hasPrediction && [
            'shadow-sm ring-1',
            'max-md:border-amber-500/28 max-md:bg-transparent max-md:ring-amber-500/22 max-md:shadow-none',
            'md:border-amber-200/80 md:bg-amber-50/90 md:ring-amber-100/90',
          ],
        isArgentinaMatch &&
          hasPrediction && ['max-md:ring-amber-500/18', 'md:ring-amber-200/60']
      )}
    >
      <CardHeader className="space-y-2 pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardDescription className="min-w-0 flex-1 text-xs leading-snug sm:text-sm">
            {matchMeta}
          </CardDescription>
          {onScheduled ? (
            <MatchScheduleBadge
              match={match}
              isScheduled={isScheduled}
              onScheduled={onScheduled}
            />
          ) : null}
        </div>
        {match.stadium ? (
          <StadiumBadge stadium={match.stadium} size="xs" className="justify-start" />
        ) : null}
        {hasBadges ? (
          <div className="flex flex-wrap items-center gap-1.5">{headerBadges}</div>
        ) : null}
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
