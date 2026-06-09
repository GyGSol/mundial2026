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
        <Table className="min-w-[280px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Jugador</TableHead>
              {statColumns.map((col) => (
                <TableHead
                  key={col.key}
                  className="hidden text-center sm:table-cell"
                  title={col.title}
                >
                  {col.label}
                </TableHead>
              ))}
              <TableHead
                className="hidden text-center sm:table-cell"
                title="Puntos bonus (consuelo)"
              >
                PB
              </TableHead>
              <TableHead className="text-right">Pts</TableHead>
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
                  <TableCell className="max-w-[9rem] font-medium sm:max-w-none">
                    <div className="flex min-w-0 items-center justify-between gap-2">
                      <span className="truncate">{row.name}</span>
                      {showGroupName && row.groupName ? (
                        <span className="text-xs font-normal text-muted-foreground">
                          {row.groupName}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  {statColumns.map((col) => (
                    <TableCell
                      key={col.key}
                      className="hidden text-center tabular-nums sm:table-cell"
                    >
                      {row[col.key] ?? 0}
                    </TableCell>
                  ))}
                  <TableCell className="hidden text-center tabular-nums sm:table-cell">
                    {row.pb ?? 0}
                  </TableCell>
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
