import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table.jsx';
import { Card, CardContent } from '@/components/ui/card.jsx';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover.jsx';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatGoalDiffScore } from '@/lib/goalDiffStats.js';
import { useLeaderboardStatDeltas } from '../hooks/useLeaderboardStatDeltas.js';
import LeaderboardUserAvatar from './LeaderboardUserAvatar.jsx';

const GDIFF_HELP =
  'Error en goles: GLdif y GVdif = diferencia promedio predicción vs resultado (÷ PJ). Gdif = (GLdif × GVdif) / 2 escalado. .000 = sin error; 1.000 = peor caso; menor es mejor.';

const statColumns = [
  { key: 'pj', label: 'PJ', title: 'Partidos jugados (finalizados y en vivo)', trackDelta: false },
  { key: 'pa', label: 'PA', title: 'Acierto resultado', trackDelta: true },
  { key: 'gl', label: 'GL', title: 'Goles local', trackDelta: true },
  { key: 'gv', label: 'GV', title: 'Goles visitante', trackDelta: true },
  {
    key: 'gdif',
    label: 'Gdif',
    helpPopup: true,
    format: 'gdif',
    trackDelta: false,
  },
  { key: 'gt', label: 'GT', title: 'Goles totales', trackDelta: true },
];

const statHeadClass = 'px-0.5 text-center text-[10px] sm:px-2 sm:text-xs';
const statCellClass = 'px-0.5 text-center tabular-nums text-xs sm:px-2 sm:text-sm';
const gdifCellClass =
  'px-0.5 text-center tabular-nums text-[11px] sm:px-2 sm:text-xs';

const prizedRankCellClass =
  'border-l-4 border-l-emerald-500 text-primary font-semibold';

function isPrizedRank(rank, prizesWinnersCount) {
  return prizesWinnersCount > 0 && rank <= prizesWinnersCount;
}

function StatColumnHead({ col }) {
  if (col.helpPopup) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex cursor-pointer items-center rounded-sm border-b border-dotted border-current/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Qué significa Gdif"
          >
            {col.label}
          </button>
        </PopoverTrigger>
        <PopoverContent align="center" className="w-72 text-sm">
          <PopoverHeader>
            <PopoverTitle>Gdif</PopoverTitle>
            <PopoverDescription>{GDIFF_HELP}</PopoverDescription>
          </PopoverHeader>
        </PopoverContent>
      </Popover>
    );
  }

  return col.label;
}

function normalizeStatDelta(delta) {
  if (!delta) return null;
  if (typeof delta === 'string') return { direction: delta };
  return delta;
}

function StatDeltaIndicator({ direction, amount, count = 1, showDown = true }) {
  if (direction === 'up') {
    const arrowCount = Math.max(1, count ?? 1);
    return (
      <span className="inline-flex shrink-0 items-center gap-0.5 text-emerald-400">
        {Array.from({ length: arrowCount }, (_, index) => (
          <ArrowUp
            key={index}
            className="size-3.5"
            strokeWidth={2.75}
            aria-hidden="true"
          />
        ))}
        {amount != null && amount > 0 ? (
          <span className="text-[10px] font-semibold tabular-nums leading-none">{amount}</span>
        ) : null}
      </span>
    );
  }
  if (direction === 'down' && showDown) {
    return (
      <span className="inline-flex shrink-0 items-center gap-0.5 text-red-400">
        <ArrowDown className="size-3.5" strokeWidth={2.75} aria-hidden="true" />
        {amount != null && amount > 0 ? (
          <span className="text-[10px] font-semibold tabular-nums leading-none">{amount}</span>
        ) : null}
      </span>
    );
  }
  return null;
}

function StatValue({ value, delta, align = 'center' }) {
  const normalized = normalizeStatDelta(delta);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5',
        align === 'center' && 'justify-center',
        align === 'right' && 'justify-end'
      )}
    >
      <span>{value}</span>
      <StatDeltaIndicator
        direction={normalized?.direction}
        amount={normalized?.amount}
        count={normalized?.count}
        showDown={false}
      />
    </span>
  );
}

function renderStatCell(row, col, { hasLiveMatches, rowDeltas }) {
  if (col.format === 'gdif') {
    return formatGoalDiffScore(row.difGl, row.difGv, row.pj);
  }

  const value = row[col.key] ?? 0;
  if (col.trackDelta && hasLiveMatches) {
    return <StatValue value={value} delta={rowDeltas[col.key]} />;
  }
  return value;
}

export default function LeaderboardTable({
  leaderboard,
  leaderboardKickoffBaseline = null,
  leaderboardLiveStatIndicators = null,
  hasLiveMatches = false,
  showGroupName = false,
  prizesWinnersCount = 0,
}) {
  const statDeltas = useLeaderboardStatDeltas(leaderboard, leaderboardKickoffBaseline, {
    hasLiveMatches,
    leaderboardLiveStatIndicators,
  });

  if (!leaderboard?.length) {
    return <p className="text-muted-foreground">Aún no hay jugadores en el ranking.</p>;
  }

  const showPrizedRanks = prizesWinnersCount > 0;

  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <Table className="min-w-[560px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-9 px-1 sm:w-11">#</TableHead>
              <TableHead className="min-w-[6.5rem] px-1 sm:min-w-[8rem] sm:px-2">Jugador</TableHead>
              {statColumns.map((col) => (
                <TableHead
                  key={col.key}
                  className={col.format === 'gdif' ? gdifCellClass : statHeadClass}
                  title={col.helpPopup ? undefined : col.title}
                >
                  <StatColumnHead col={col} />
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
              const rankDelta = normalizeStatDelta(rowDeltas.rank);

              return (
                <TableRow key={row.id}>
                  <TableCell
                    className={cn(
                      'px-1 tabular-nums sm:px-2',
                      prizedRank ? prizedRankCellClass : 'text-muted-foreground'
                    )}
                  >
                    <span className="text-base font-bold leading-none sm:text-lg">{row.rank}</span>
                  </TableCell>
                  <TableCell className="max-w-[6.5rem] px-1 font-medium sm:max-w-none sm:px-2">
                    <div className="flex min-w-0 items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <LeaderboardUserAvatar
                          name={row.name}
                          avatarUrl={row.avatarUrl}
                          isAiUser={row.isAiUser}
                        />
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
                        <StatDeltaIndicator
                          direction={rankDelta?.direction}
                          amount={rankDelta?.amount}
                          showDown
                        />
                      </span>
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
                      className={col.format === 'gdif' ? gdifCellClass : statCellClass}
                    >
                      {renderStatCell(row, col, { hasLiveMatches, rowDeltas })}
                    </TableCell>
                  ))}
                  <TableCell className={statCellClass}>
                    {hasLiveMatches ? (
                      <StatValue value={row.pb ?? 0} delta={rowDeltas.pb} />
                    ) : (
                      (row.pb ?? 0)
                    )}
                  </TableCell>
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
