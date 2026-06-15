import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table.jsx';
import { Card, CardContent } from '@/components/ui/card.jsx';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLeaderboardStatDeltas } from '../hooks/useLeaderboardStatDeltas.js';

const statColumns = [
  { key: 'pj', label: 'PJ', title: 'Partidos jugados (finalizados y en vivo)', trackDelta: false },
  { key: 'pa', label: 'PA', title: 'Acierto resultado', trackDelta: true },
  { key: 'gl', label: 'GL', title: 'Goles local', trackDelta: true },
  { key: 'gv', label: 'GV', title: 'Goles visitante', trackDelta: true },
  { key: 'gt', label: 'GT', title: 'Goles totales', trackDelta: true },
];

const statHeadClass = 'px-0.5 text-center text-[10px] sm:px-2 sm:text-xs';
const statCellClass = 'px-0.5 text-center tabular-nums text-xs sm:px-2 sm:text-sm';

const prizedRankCellClass =
  'border-l-4 border-l-emerald-500 text-primary font-semibold';

function isPrizedRank(rank, prizesWinnersCount) {
  return prizesWinnersCount > 0 && rank <= prizesWinnersCount;
}

function normalizeStatDelta(delta) {
  if (!delta) return null;
  if (typeof delta === 'string') return { direction: delta };
  return delta;
}

function StatDeltaIndicator({ direction, amount }) {
  if (direction === 'up') {
    return (
      <span className="inline-flex shrink-0 items-center gap-0.5 text-emerald-500">
        <ArrowUp className="size-3" strokeWidth={2.75} aria-hidden="true" />
        {amount != null && amount > 0 ? (
          <span className="text-[10px] font-semibold tabular-nums leading-none">{amount}</span>
        ) : null}
      </span>
    );
  }
  if (direction === 'down') {
    return (
      <span className="inline-flex shrink-0 items-center gap-0.5 text-red-500">
        <ArrowDown className="size-3" strokeWidth={2.75} aria-hidden="true" />
        {amount != null && amount > 0 ? (
          <span className="text-[10px] font-semibold tabular-nums leading-none">{amount}</span>
        ) : null}
      </span>
    );
  }
  if (direction === 'neutral') {
    return (
      <span
        className="inline-flex size-3 shrink-0 items-center justify-center"
        aria-hidden="true"
        title="Sin puntos nuevos en este partido"
      >
        <span className="size-2 rounded-full bg-yellow-400" />
      </span>
    );
  }
  return null;
}

function StatValue({ value, delta, align = 'center', valueClassName }) {
  const normalized = normalizeStatDelta(delta);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5',
        align === 'center' && 'justify-center',
        align === 'right' && 'justify-end'
      )}
    >
      <span className={valueClassName}>{value}</span>
      <StatDeltaIndicator direction={normalized?.direction} amount={normalized?.amount} />
    </span>
  );
}

export default function LeaderboardTable({
  leaderboard,
  leaderboardKickoffBaseline = null,
  refreshStamp = null,
  showGroupName = false,
  prizesWinnersCount = 0,
}) {
  const statDeltas = useLeaderboardStatDeltas(
    leaderboard,
    leaderboardKickoffBaseline,
    refreshStamp
  );

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
              <TableHead className="w-11 px-1 sm:w-14">#</TableHead>
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
              const rowDeltas = statDeltas[row.id] ?? {};

              return (
                <TableRow key={row.id}>
                  <TableCell
                    className={cn(
                      'px-1 tabular-nums sm:px-2',
                      prizedRank ? prizedRankCellClass : 'text-muted-foreground'
                    )}
                  >
                    <StatValue
                      value={row.rank}
                      delta={rowDeltas.rank}
                      valueClassName="text-base font-bold leading-none sm:text-lg"
                    />
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
                      {col.trackDelta ? (
                        <StatValue value={row[col.key] ?? 0} delta={rowDeltas[col.key]} />
                      ) : (
                        (row[col.key] ?? 0)
                      )}
                    </TableCell>
                  ))}
                  <TableCell className={statCellClass}>
                    <StatValue value={row.pb ?? 0} delta={rowDeltas.pb} />
                  </TableCell>
                  <TableCell className="px-1 text-right text-xs font-semibold tabular-nums sm:px-2 sm:text-sm">
                    <StatValue
                      value={row.totalPoints}
                      delta={rowDeltas.totalPoints}
                      align="right"
                    />
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
