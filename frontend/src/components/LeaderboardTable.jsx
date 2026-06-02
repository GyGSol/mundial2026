import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table.jsx';
import { Card, CardContent } from '@/components/ui/card.jsx';
import { cn } from '@/lib/utils';

const statColumns = [
  { key: 'pa', label: 'PA', title: 'Acierto resultado' },
  { key: 'gl', label: 'GL', title: 'Goles local' },
  { key: 'gv', label: 'GV', title: 'Goles visitante' },
  { key: 'gt', label: 'GT', title: 'Goles totales' },
];

function buildPrizeByPosition(prizes = []) {
  return new Map(
    (Array.isArray(prizes) ? prizes : []).map((row) => [Number(row.position), row.prize || ''])
  );
}

/** Colores de la barra lateral por puesto premiado (como en la referencia visual). */
function getPrizeRankAccent(rank, prizesWinnersCount) {
  if (rank > prizesWinnersCount || prizesWinnersCount <= 0) return null;
  if (rank <= 2) return 'emerald';
  if (rank === 3) return 'sky';
  return 'amber';
}

const prizeRankAccentClasses = {
  emerald: 'border-l-4 border-l-emerald-500 text-primary font-semibold',
  sky: 'border-l-4 border-l-sky-400 text-primary font-semibold',
  amber: 'border-l-4 border-l-amber-400 text-primary font-semibold',
};

export default function LeaderboardTable({
  leaderboard,
  showGroupName = false,
  prizes = [],
  prizesWinnersCount = 0,
}) {
  if (!leaderboard?.length) {
    return <p className="text-muted-foreground">Aún no hay jugadores en el ranking.</p>;
  }

  const showPrizes = prizesWinnersCount > 0;
  const prizeByPosition = buildPrizeByPosition(prizes);

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Jugador</TableHead>
              {statColumns.map((col) => (
                <TableHead key={col.key} className="text-center" title={col.title}>
                  {col.label}
                </TableHead>
              ))}
              <TableHead className="text-center" title="Puntos bonus (consuelo)">
                PB
              </TableHead>
              {showPrizes ? <TableHead>Premio</TableHead> : null}
              <TableHead className="text-right">Puntos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaderboard.map((row) => {
              const prizeText =
                showPrizes && row.rank <= prizesWinnersCount
                  ? (prizeByPosition.get(row.rank) || '').trim() || '—'
                  : null;
              const prizeAccent = showPrizes
                ? getPrizeRankAccent(row.rank, prizesWinnersCount)
                : null;

              return (
                <TableRow key={row.id}>
                  <TableCell
                    className={cn(
                      'text-muted-foreground tabular-nums',
                      prizeAccent ? prizeRankAccentClasses[prizeAccent] : null
                    )}
                  >
                    {row.rank}
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center justify-between gap-2">
                      <span>{row.name}</span>
                      {showGroupName && row.groupName ? (
                        <span className="text-xs font-normal text-muted-foreground">
                          {row.groupName}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  {statColumns.map((col) => (
                    <TableCell key={col.key} className="text-center tabular-nums">
                      {row[col.key] ?? 0}
                    </TableCell>
                  ))}
                  <TableCell className="text-center tabular-nums">{row.pb ?? 0}</TableCell>
                  {showPrizes ? (
                    <TableCell className="max-w-[200px] text-sm text-muted-foreground">
                      {prizeText ?? '—'}
                    </TableCell>
                  ) : null}
                  <TableCell className="text-right font-semibold tabular-nums">
                    {row.totalPoints}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
