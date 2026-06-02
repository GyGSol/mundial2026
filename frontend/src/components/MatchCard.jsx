import { CalendarPlus } from 'lucide-react';
import PredictionForm from './PredictionForm.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card.jsx';
import { cn } from '@/lib/utils';
import { matchInvolvesArgentina } from '@/lib/teamMeta';
import { formatMatchDate, formatLockHint } from '@/lib/dateFormat';
import {
  canExportCalendarReminder,
  downloadMatchReminderIcs,
  formatReminderHint,
} from '@/lib/predictionCalendar.js';

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
  const showCalendarReminder = canExportCalendarReminder(match);
  const reminderHint = showCalendarReminder ? formatReminderHint(match) : null;

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
          <CardDescription>
            Grupo {match.group} · {formatMatchDate(match)}
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-2">
        {lockHint && match.predictionOpen ? (
          <p className="text-xs text-muted-foreground">{lockHint}</p>
        ) : null}
        {reminderHint ? (
          <p className="text-xs text-muted-foreground">{reminderHint}</p>
        ) : null}
        {showCalendarReminder ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit gap-2"
            onClick={() => downloadMatchReminderIcs(match)}
          >
            <CalendarPlus className="size-4 shrink-0" aria-hidden />
            Agregar recordatorio al calendario
          </Button>
        ) : null}
        <PredictionForm match={match} onSave={onSave} saving={savingId === match.id} />
      </CardContent>
    </Card>
  );
}
