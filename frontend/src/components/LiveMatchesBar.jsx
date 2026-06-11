import { getTeamFlag, matchInvolvesArgentina } from '@/lib/teamMeta';
import { Badge } from '@/components/ui/badge.jsx';
import { Card, CardContent } from '@/components/ui/card.jsx';
import { cn } from '@/lib/utils';
import { formatMatchDate } from '@/lib/dateFormat';
import BroadcastBadges from '@/components/BroadcastBadges.jsx';
import KickoffCountdown from '@/components/KickoffCountdown.jsx';

function LiveMatchCard({ match }) {
  const homeName = match.homeTeam?.nameEn || 'Local';
  const awayName = match.awayTeam?.nameEn || 'Visitante';
  const homeFlag = getTeamFlag(match.homeTeam);
  const awayFlag = getTeamFlag(match.awayTeam);
  const isArgentina = matchInvolvesArgentina(match);

  return (
    <Card
      className={cn(
        'min-w-[240px] shrink-0',
        isArgentina && 'border-sky-300/80 bg-sky-50/95 ring-1 ring-sky-200/90'
      )}
    >
      <CardContent className="flex flex-col items-center gap-2 p-4">
        <Badge variant="outline" className="border-red-300/70 bg-red-50 text-red-800">
          En vivo
        </Badge>

        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center gap-1">
            {homeFlag && (
              <img src={homeFlag} alt={homeName} className="size-8 rounded-sm border object-cover" />
            )}
            <span className="max-w-[5rem] truncate text-xs font-medium">{homeName}</span>
          </div>

          <div className="flex items-center gap-1 text-xl font-bold tabular-nums">
            <span>{match.homeScore}</span>
            <span className="text-muted-foreground">-</span>
            <span>{match.awayScore}</span>
          </div>

          <div className="flex flex-col items-center gap-1">
            {awayFlag && (
              <img src={awayFlag} alt={awayName} className="size-8 rounded-sm border object-cover" />
            )}
            <span className="max-w-[5rem] truncate text-xs font-medium">{awayName}</span>
          </div>
        </div>

        <span className="text-[11px] text-muted-foreground">
          Grupo {match.group} · {formatMatchDate(match)}
        </span>
        <BroadcastBadges broadcasters={match.broadcasters} size="md" />
      </CardContent>
    </Card>
  );
}

function NextMatchCard({ match }) {
  const homeName = match.homeTeam?.nameEn || 'Local';
  const awayName = match.awayTeam?.nameEn || 'Visitante';
  const homeFlag = getTeamFlag(match.homeTeam);
  const awayFlag = getTeamFlag(match.awayTeam);
  const isArgentina = matchInvolvesArgentina(match);

  return (
    <Card
      className={cn(
        'w-full max-w-xl',
        isArgentina && 'border-sky-300/80 bg-sky-50/95 ring-1 ring-sky-200/90'
      )}
    >
      <CardContent className="flex flex-col items-center gap-2 p-4">
        <Badge variant="outline" className="border-sky-300/70 bg-sky-50 text-sky-900">
          Próximo partido
        </Badge>

        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center gap-1">
            {homeFlag && (
              <img src={homeFlag} alt={homeName} className="size-8 rounded-sm border object-cover" />
            )}
            <span className="max-w-[5rem] truncate text-xs font-medium">{homeName}</span>
          </div>

          <span className="text-lg font-semibold text-muted-foreground">vs</span>

          <div className="flex flex-col items-center gap-1">
            {awayFlag && (
              <img src={awayFlag} alt={awayName} className="size-8 rounded-sm border object-cover" />
            )}
            <span className="max-w-[5rem] truncate text-xs font-medium">{awayName}</span>
          </div>
        </div>

        <KickoffCountdown
          kickoffAt={match.kickoffAt}
          className="text-sm font-medium text-foreground"
        />

        <span className="text-[11px] text-muted-foreground">
          {match.group ? `Grupo ${match.group} · ` : ''}
          {formatMatchDate(match)}
        </span>
        <BroadcastBadges broadcasters={match.broadcasters} size="md" />
      </CardContent>
    </Card>
  );
}

function EmptyMatchesState() {
  return (
    <div className="flex justify-center">
      <Card className="w-full max-w-xl border-dashed">
        <CardContent className="flex flex-col items-center gap-1 py-5 text-center">
          <p className="text-sm font-medium text-foreground">No hay partidos en curso</p>
          <p className="text-sm text-muted-foreground">
            Cuando cierren las predicciones (1 hora antes del inicio), el próximo partido va a
            aparecer acá. Cuando empiece en vivo, lo vas a ver con el marcador actualizado.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LiveMatchesBar({ matches = [], nextMatch = null }) {
  if (matches.length > 0) {
    return (
      <div className="flex flex-col items-center gap-3">
        <p className="text-sm font-medium text-muted-foreground">Partidos en curso</p>
        <div className="-mx-4 flex w-full gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {matches.map((match) => (
            <LiveMatchCard key={match.id} match={match} />
          ))}
        </div>
      </div>
    );
  }

  if (nextMatch) {
    return (
      <div className="flex flex-col items-center gap-3">
        <p className="text-sm font-medium text-muted-foreground">Próximo partido</p>
        <NextMatchCard match={nextMatch} />
      </div>
    );
  }

  return <EmptyMatchesState />;
}
