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
  { key: 'pj', label: 'PJ', title: 'Partidos jugados (finalizados y en vivo)' },
  { key: 'pa', label: 'PA', title: 'Acierto resultado' },
  { key: 'gl', label: 'GL', title: 'Goles local' },
  { key: 'gv', label: 'GV', title: 'Goles visitante' },
  { key: 'gt', label: 'GT', title: 'Goles totales' },
];

const statHeadClass = 'px-0.5 text-center text-[10px] sm:px-2 sm:text-xs';
const statCellClass = 'px-0.5 text-center tabular-nums text-xs sm:px-2 sm:text-sm';

const prizedRankCellClass =
  'border-l-4 border-l-emerald-500 text-primary font-semibold';

function isPrizedRank(rank, prizesWinnersCount) {
  return prizesWinnersCount > 0 && rank <= prizesWinnersCount;
}

export default function LeaderboardTable({
  leaderboard,
  showGroupName = false,
  prizesWinnersCount = 0,
}) {
  if (!leaderboard?.length) {
    return <p className="text-muted-foreground">Aún no hay jugadores en el ranking.</p>;
  }

  const showPrizedRanks = prizesWinnersCount > 0;

  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <Table className="min-w-[520px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-8 px-1 sm:w-10">#</TableHead>
              <TableHead className="min-w-[5.5rem] px-1 sm:min-w-0 sm:px-2">Jugador</TableHead>
              {statColumns.map((col) => (
                <TableHead key={col.key} className={statHeadClass} title={col.title}>
                  {col.label}
                </TableHead>
              ))}
              <TableHead className={statHeadClass} title="Puntos bonus (consuelo)">
                PB
              </TableHead>
              <TableHead className="px-1 text-right text-[10px] sm:px-2 sm:text-xs">Pts</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaderboard.map((row) => {
              const prizedRank = showPrizedRanks && isPrizedRank(row.rank, prizesWinnersCount);

              return (
                <TableRow key={row.id}>
                  <TableCell
                    className={cn(
                      'text-muted-foreground tabular-nums',
                      prizedRank ? prizedRankCellClass : null
                    )}
                  >
                    {row.rank}
                  </TableCell>
                  <TableCell className="max-w-[5.5rem] px-1 font-medium sm:max-w-none sm:px-2">
                    <div className="flex min-w-0 items-center justify-between gap-2">
                      <span className="truncate">
                        {row.name}
                        {row.isAiUser ? (
                          <span
                            className="ml-1.5 inline-flex rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300"
                            title="Predicciones generadas por IA"
                          >
                            IA
                          </span>
                        ) : null}
                      </span>
                      {showGroupName && row.groupName ? (
                        <span className="text-xs font-normal text-muted-foreground">
                          {row.groupName}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  {statColumns.map((col) => (
                    <TableCell key={col.key} className={statCellClass}>
                      {row[col.key] ?? 0}
                    </TableCell>
                  ))}
                  <TableCell className={statCellClass}>{row.pb ?? 0}</TableCell>
                  <TableCell className="px-1 text-right text-xs font-semibold tabular-nums sm:px-2 sm:text-sm">
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
