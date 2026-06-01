import { getTeamFlag, matchInvolvesArgentina } from '@/lib/teamMeta';
import { Badge } from '@/components/ui/badge.jsx';
import { Card, CardContent } from '@/components/ui/card.jsx';
import { cn } from '@/lib/utils';
import { formatMatchDate } from '@/lib/dateFormat';

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
      </CardContent>
    </Card>
  );
}

export default function LiveMatchesBar({ matches = [] }) {
  if (!matches.length) {
    return (
      <div className="flex justify-center">
        <Card className="w-full max-w-xl border-dashed">
          <CardContent className="flex flex-col items-center gap-1 py-5 text-center">
            <p className="text-sm font-medium text-foreground">No hay partidos en curso</p>
            <p className="text-sm text-muted-foreground">
              Cuando empiece un partido en vivo, lo vas a ver acá con el marcador actualizado.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-sm font-medium text-muted-foreground">Partidos en curso</p>
      <div className="flex w-full flex-wrap items-stretch justify-center gap-3">
        {matches.map((match) => (
          <LiveMatchCard key={match.id} match={match} />
        ))}
      </div>
    </div>
  );
}
