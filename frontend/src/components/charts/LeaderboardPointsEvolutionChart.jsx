import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  axisTick,
  chartColors,
  chartMargin,
  tooltipStyle,
} from '../worldcup/datacenter/chartTheme.js';

/** Posición 0 (inicio) abajo; 1° arriba en el eje numérico del gráfico. */
export function rankToChartY(rank, playerCount) {
  if (!rank) return 0;
  return playerCount + 1 - rank;
}

export function chartYToRank(chartY, playerCount) {
  if (!chartY) return 0;
  return playerCount + 1 - chartY;
}

function formatTooltipTitle(x, matchupLabel) {
  if (x === 0) return 'Inicio';
  if (matchupLabel && matchupLabel !== 'Inicio') {
    return `Partido ${x} · ${matchupLabel}`;
  }
  return `Partido ${x}`;
}

function buildChartRows(checkpoints, series, hiddenUserIds, playerCount) {
  return checkpoints.map((checkpoint, checkpointIndex) => {
    const row = {
      x: checkpoint.index,
      matchupLabel: checkpoint.label,
    };
    for (const player of series) {
      if (hiddenUserIds.has(player.userId)) continue;
      const rank = player.ranks[checkpointIndex] ?? 0;
      row[player.userId] = rankToChartY(rank, playerCount);
    }
    return row;
  });
}

function RankTooltip({ active, payload, playerCount }) {
  if (!active || !payload?.length) return null;

  const point = payload[0]?.payload;
  const title = formatTooltipTitle(point?.x ?? 0, point?.matchupLabel);

  const sorted = [...payload].sort((a, b) => {
    const rankA = chartYToRank(a.value ?? 0, playerCount);
    const rankB = chartYToRank(b.value ?? 0, playerCount);
    if (rankA === rankB) return String(a.name).localeCompare(String(b.name), 'es');
    if (!rankA) return 1;
    if (!rankB) return -1;
    return rankA - rankB;
  });

  return (
    <div style={tooltipStyle} className="max-w-[min(18rem,calc(100vw-2rem))] px-2.5 py-2">
      <p className="mb-1.5 text-xs font-medium text-foreground">{title}</p>
      <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto text-xs">
        {sorted.map((entry) => {
          const rank = chartYToRank(entry.value ?? 0, playerCount);
          return (
            <li key={entry.dataKey} className="flex items-center justify-between gap-3">
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: entry.color }}
                  aria-hidden
                />
                <span className="truncate text-muted-foreground">{entry.name}</span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-foreground">
                {rank ? `${rank}°` : 'Inicio'}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function useIsNarrowViewport() {
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 639px)');
    const update = () => setIsNarrow(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return isNarrow;
}

export default function LeaderboardPointsEvolutionChart({
  checkpoints = [],
  series = [],
  hiddenUserIds = new Set(),
}) {
  const playerCount = series.length;
  const isNarrow = useIsNarrowViewport();

  const visibleSeries = useMemo(
    () => series.filter((player) => !hiddenUserIds.has(player.userId)),
    [series, hiddenUserIds]
  );

  const chartData = useMemo(
    () => buildChartRows(checkpoints, series, hiddenUserIds, playerCount),
    [checkpoints, series, hiddenUserIds, playerCount]
  );

  const xTicks = useMemo(() => checkpoints.map((checkpoint) => checkpoint.index), [checkpoints]);

  const chartMinWidth = useMemo(() => {
    if (!isNarrow) return undefined;
    return Math.max(300, xTicks.length * 32);
  }, [isNarrow, xTicks.length]);

  if (!visibleSeries.length || checkpoints.length < 2) {
    return (
      <p className="text-sm text-muted-foreground">
        Aún no hay partidos puntuados para mostrar la evolución.
      </p>
    );
  }

  const chartHeight = isNarrow ? 'min(22rem, 52vh)' : 'min(28rem, 62vh)';
  const yAxisWidth = isNarrow ? 28 : 36;

  return (
    <div className="-mx-1 overflow-x-auto overscroll-x-contain sm:mx-0 sm:overflow-visible">
      <div
        className="w-full"
        style={{
          minWidth: chartMinWidth,
          height: chartHeight,
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{
              ...chartMargin,
              top: 12,
              bottom: isNarrow ? 8 : 16,
              left: isNarrow ? 0 : 4,
              right: isNarrow ? 4 : 16,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
            <XAxis
              dataKey="x"
              type="number"
              domain={[0, 'dataMax']}
              ticks={xTicks}
              tick={{ ...axisTick, fontSize: isNarrow ? 10 : 11 }}
              tickFormatter={(value) => String(value)}
              interval={0}
              height={28}
              label={
                isNarrow
                  ? undefined
                  : {
                      value: 'Partido',
                      position: 'insideBottom',
                      offset: -4,
                      style: { fill: 'hsl(var(--muted-foreground))', fontSize: 11 },
                    }
              }
            />
            <YAxis
              tick={{ ...axisTick, fontSize: isNarrow ? 10 : 11 }}
              allowDecimals={false}
              domain={[0, playerCount]}
              width={yAxisWidth}
              tickFormatter={(value) => {
                if (value === 0) return '0';
                return `${chartYToRank(value, playerCount)}°`;
              }}
              label={
                isNarrow
                  ? undefined
                  : {
                      value: 'Posición',
                      angle: -90,
                      position: 'insideLeft',
                      style: { fill: 'hsl(var(--muted-foreground))', fontSize: 11 },
                    }
              }
            />
            <Tooltip content={<RankTooltip playerCount={playerCount} />} />
            {visibleSeries.map((player) => (
              <Line
                key={player.userId}
                type="natural"
                dataKey={player.userId}
                name={player.name}
                stroke={player.color}
                strokeWidth={isNarrow ? 2 : 2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                dot={false}
                activeDot={{ r: isNarrow ? 4 : 5, strokeWidth: 2, fill: 'hsl(var(--card))' }}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {isNarrow && xTicks.length > 8 ? (
        <p className="mt-1 text-center text-[11px] text-muted-foreground">
          Deslizá horizontalmente para ver todos los partidos
        </p>
      ) : null}
    </div>
  );
}
