import { useCallback } from 'react';
import { ExternalLink, Radio, TvMinimalPlay } from 'lucide-react';
import { transmissionsApi } from '../api/client.js';
import { useLiveData } from '../hooks/useLiveData.js';
import { REALTIME_EVENTS } from '../lib/realtimeSectors.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import LiveMatchTrigger from '../components/live/LiveMatchTrigger.jsx';
import TeamHeader from '../components/TeamHeader.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card.jsx';
import { cn } from '@/lib/utils';
import WeatherOpsBadge, { LiveScheduleAlert } from '@/components/WeatherOpsBadge.jsx';
import { ARGENTINA_TIMEZONE, formatMatchDate } from '@/lib/dateFormat';
import { isIosDevice } from '@/lib/device';
import { USER_STREAM_BRAND } from '@/lib/streamBrand.js';
import { resolveFieldMatchScores } from '@/lib/matchDisplayScore.js';
import { PenaltyShootoutScoreLine } from '@/components/PenaltyShootoutDisplay.jsx';

const FPT_AGENDA_URL = 'https://futbolparatodos.su/agenda.php';

const statusLabels = {
  upcoming: { text: 'Próximo', variant: 'secondary' },
  live: { text: 'En vivo', variant: 'outline' },
  finished: { text: 'Finalizado', variant: 'default' },
};

function formatDayLabel(dateKey) {
  if (!dateKey) return 'Hoy';
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return date.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: ARGENTINA_TIMEZONE,
  });
}

function StreamStatusBadge({ match }) {
  const { stream, status } = match;
  if (stream?.canWatch && status === 'upcoming') {
    return (
      <Badge variant="outline" className="border-amber-500/35 bg-amber-500/10 text-amber-100">
        Calentamiento
      </Badge>
    );
  }
  if (stream?.canWatch && (stream?.streamCount ?? 0) > 1) {
    return (
      <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-100">
        {stream.streamCount} señales
      </Badge>
    );
  }
  if (status === 'live' && stream?.canWatch) {
    return (
      <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-100">
        Señal disponible
      </Badge>
    );
  }
  if (status === 'live' && !stream?.configured) {
    return (
      <Badge variant="outline" className="border-amber-500/35 bg-amber-500/10 text-amber-100">
        Sin señal configurada
      </Badge>
    );
  }
  if (stream?.configured) {
    return (
      <Badge variant="outline" className="border-sky-500/35 bg-sky-500/10 text-sky-100">
        Señal lista
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      Pendiente de configurar
    </Badge>
  );
}

function TransmissionMatchCard({ match }) {
  const status = statusLabels[match.status] || statusLabels.upcoming;
  const kickoff = formatMatchDate(match, { showTimezone: true, timeZone: ARGENTINA_TIMEZONE });
  const iosDevice = isIosDevice();
  const streamPageUrl = match.stream?.pageUrl;
  const { homeScore, awayScore } = resolveFieldMatchScores(match);
  const scoreLine =
    match.status !== 'upcoming' && homeScore != null && awayScore != null
      ? `${homeScore} – ${awayScore}`
      : null;

  return (
    <Card
      className={cn(
        'transition-colors',
        match.status === 'live' && 'border-emerald-500/30 ring-1 ring-emerald-500/20',
        match.status === 'upcoming' &&
          match.stream?.canWatch &&
          'border-amber-500/30 ring-1 ring-amber-500/20'
      )}
    >
      <CardHeader className="space-y-2 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardDescription className="text-xs sm:text-sm">{kickoff}</CardDescription>
          <div className="flex flex-wrap items-center gap-1.5">
            {match.status !== 'upcoming' ? (
              <Badge variant={status.variant}>{status.text}</Badge>
            ) : null}
            <StreamStatusBadge match={match} />
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <WeatherOpsBadge weatherOps={match.weatherOps} weatherRisk={match.weatherRisk} />
        <LiveScheduleAlert liveScheduleContext={match.liveScheduleContext} />

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 md:gap-4">
          <TeamHeader team={match.homeTeam} slotLabel={match.homeTeamSlotLabel} />
          <div className="flex flex-col items-center gap-1 px-1 text-center">
            {scoreLine ? (
              <>
                <p className="text-xl font-bold tabular-nums md:text-2xl">{scoreLine}</p>
                <PenaltyShootoutScoreLine penaltyShootout={match.penaltyShootout} />
              </>
            ) : (
              <span className="text-sm font-medium text-muted-foreground">vs</span>
            )}
          </div>
          <TeamHeader team={match.awayTeam} slotLabel={match.awayTeamSlotLabel} />
        </div>

        {match.stream?.canWatch ? (
          <div className="flex flex-col gap-2">
            {match.status === 'upcoming' ? (
              <p className="text-sm text-muted-foreground">
                Predicciones cerradas · podés ver el calentamiento antes del kickoff.
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              {match.stream?.canWatch && iosDevice && streamPageUrl ? (
                <Button size="sm" className="gap-1.5" asChild>
                  <a href={streamPageUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-4 shrink-0" aria-hidden />
                    Abrir en Safari
                  </a>
                </Button>
              ) : null}
              <LiveMatchTrigger
                match={match}
                label={
                  match.status === 'upcoming'
                    ? 'Ver calentamiento'
                    : iosDevice
                      ? 'Ver en la app'
                      : 'Ver transmisión'
                }
              />
            </div>
            {match.status === 'live' && !match.stream?.configured ? (
              <p className="text-sm text-muted-foreground">
                Todavía no hay señal configurada para este partido. Podés buscarlo en{' '}
                <a
                  href={FPT_AGENDA_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-200/90 underline-offset-2 hover:underline"
                >
                  Partidos de hoy ({USER_STREAM_BRAND})
                </a>
                .
              </p>
            ) : null}
          </div>
        ) : null}

        {match.status === 'upcoming' && match.stream?.configured && !match.stream?.canWatch ? (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <TvMinimalPlay className="size-4 shrink-0" aria-hidden />
            Cuando cierren las predicciones podrás ver el calentamiento acá.
          </p>
        ) : null}

        {match.status === 'upcoming' && !match.stream?.configured ? (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <TvMinimalPlay className="size-4 shrink-0" aria-hidden />
            Cuando empiece el partido podrás ver la transmisión acá.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function shouldPollTransmissions(data) {
  return (data?.liveCount ?? 0) > 0;
}

export default function TransmissionsPage() {
  const fetchToday = useCallback(() => transmissionsApi.today(), []);
  const { data, loading, error, lastUpdated } = useLiveData(fetchToday, [], {
    enabled: true,
    pollIntervalMs: 20000,
    pollWhen: shouldPollTransmissions,
    realtimeEvents: [REALTIME_EVENTS.MATCHES_UPDATED],
    realtimeDebounceMs: 750,
  });

  const matches = data?.matches ?? [];
  const dayLabel = formatDayLabel(data?.date);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Radio className="size-5 text-emerald-400" strokeWidth={1.75} aria-hidden />
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Transmisiones</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Partidos de {dayLabel}. Las señales en vivo usan {USER_STREAM_BRAND} cuando están disponibles.
          {lastUpdated
            ? ` · Actualizado ${lastUpdated.toLocaleTimeString('es-AR', {
                hour: '2-digit',
                minute: '2-digit',
              })}`
            : null}
        </p>
      </div>

      {loading && !matches.length ? <LoadingSpinner /> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {!loading && !error && !matches.length ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No hay partidos programados para hoy.
          </CardContent>
        </Card>
      ) : null}

      {matches.length ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground sm:text-sm">
            <span>{matches.length} partido{matches.length === 1 ? '' : 's'}</span>
            {data?.liveCount ? (
              <span>· {data.liveCount} en vivo</span>
            ) : null}
            {data?.configuredCount ? (
              <span>· {data.configuredCount} con señal</span>
            ) : null}
          </div>

          {matches.map((match) => (
            <TransmissionMatchCard key={match._id || match.externalId} match={match} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
