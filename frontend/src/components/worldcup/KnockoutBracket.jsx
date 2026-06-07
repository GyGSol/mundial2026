import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { getTeamFlag } from '@/lib/teamMeta';
import { KnockoutSection } from '@/components/worldcup/WorldCupSections.jsx';
import {
  BRACKET_COLUMN_LABELS,
  BRACKET_GRID_COLS,
  BRACKET_GRID_ROWS,
  BRACKET_NODES,
  getBracketConnectors,
  getNodeCenter,
  indexKnockoutMatches,
  isOfficialKnockoutBracket,
} from '@/lib/worldCupBracketLayout.js';

const MIN_CELL_W = 108;
const MIN_CELL_H = 56;

function useBracketDimensions(containerRef) {
  const [cellW, setCellW] = useState(MIN_CELL_W);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const width = el.clientWidth;
      if (width <= 0) return;
      setCellW(Math.max(MIN_CELL_W, width / BRACKET_GRID_COLS));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [containerRef]);

  const cellH = Math.max(MIN_CELL_H, Math.round(cellW * 0.48));
  const width = BRACKET_GRID_COLS * cellW;
  const height = BRACKET_GRID_ROWS * cellH;

  return { cellW, cellH, width, height };
}

function nodeCenterPx(node, cellW, cellH) {
  const center = getNodeCenter(node);
  return {
    x: (center.col - 1) * cellW + cellW / 2,
    y: (center.row - 1) * cellH + cellH / 2,
  };
}

function buildConnectorPath(fromId, toId, cellW, cellH) {
  const fromNode = BRACKET_NODES[fromId];
  const toNode = BRACKET_NODES[toId];
  if (!fromNode || !toNode) return '';

  const from = nodeCenterPx(fromNode, cellW, cellH);
  const to = nodeCenterPx(toNode, cellW, cellH);
  const fromEdgeX = from.x + (to.x >= from.x ? cellW * 0.28 : -cellW * 0.28);
  const toEdgeX = to.x + (to.x >= from.x ? -cellW * 0.28 : cellW * 0.28);
  const midX = (fromEdgeX + toEdgeX) / 2;

  return `M ${fromEdgeX} ${from.y} H ${midX} V ${to.y} H ${toEdgeX}`;
}

function BracketCountryLine({ team, slotLabel, score, isWinner, isLive }) {
  const flagUrl = team ? getTeamFlag(team) : null;
  const label = team?.nameEn || team?.fifaCode || slotLabel || 'Por definir';

  return (
    <div
      className={cn(
        'flex w-full min-w-0 items-center justify-center gap-1.5 px-1',
        isWinner && 'font-bold',
        isLive && !isWinner && 'opacity-90'
      )}
      title={label}
    >
      {team ? (
        flagUrl ? (
          <img
            src={flagUrl}
            alt=""
            className="size-4 shrink-0 rounded-sm border border-border/60 object-cover sm:size-5"
          />
        ) : team.flag ? (
          <span className="shrink-0 text-sm leading-none">{team.flag}</span>
        ) : (
          <span className="size-4 shrink-0 rounded-sm border border-dashed border-primary/30 bg-primary/5 sm:size-5" />
        )
      ) : null}
      <span
        className={cn(
          'min-w-0 text-center text-[11px] leading-tight text-primary sm:text-xs',
          !team && 'font-medium'
        )}
      >
        {label}
      </span>
      {score != null ? (
        <span
          className={cn(
            'shrink-0 text-xs font-bold tabular-nums text-primary sm:text-sm',
            isWinner && 'text-primary'
          )}
        >
          {score}
        </span>
      ) : null}
    </div>
  );
}

function BracketMatchCell({ match, highlight = false }) {
  const isLive = match?.status === 'live';
  const isFinished = match?.status === 'finished';
  const hasScore = isFinished || isLive;

  const homeTitle = match?.homeTeam?.nameEn || match?.homeTeamSlotLabel || 'Por definir';
  const awayTitle = match?.awayTeam?.nameEn || match?.awayTeamSlotLabel || 'Por definir';

  const homeWinner = hasScore && match.homeScore > match.awayScore;
  const awayWinner = hasScore && match.awayScore > match.homeScore;

  return (
    <div
      className={cn(
        'flex h-full w-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-md border bg-card px-1.5 py-2 shadow-sm',
        highlight ? 'border-primary/60 ring-1 ring-primary/20' : 'border-border/70',
        isLive && 'border-emerald-400/70 bg-emerald-50/30'
      )}
      title={`Partido ${match?.externalId ?? ''}: ${homeTitle} vs ${awayTitle}`}
    >
      <BracketCountryLine
        team={match?.homeTeam}
        slotLabel={match?.homeTeamSlotLabel}
        score={hasScore ? match.homeScore : null}
        isWinner={homeWinner}
        isLive={isLive}
      />

      <span className="text-[10px] font-semibold uppercase tracking-wide text-primary/70">vs</span>

      <BracketCountryLine
        team={match?.awayTeam}
        slotLabel={match?.awayTeamSlotLabel}
        score={hasScore ? match.awayScore : null}
        isWinner={awayWinner}
        isLive={isLive}
      />
    </div>
  );
}

function BracketConnectors({ cellW, cellH, width, height }) {
  const paths = useMemo(() => {
    return getBracketConnectors().map(({ from, to }) => ({
      id: `${from}-${to}`,
      d: buildConnectorPath(from, to, cellW, cellH),
    }));
  }, [cellW, cellH]);

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full text-border"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      {paths.map(({ id, d }) => (
        <path
          key={id}
          d={d}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          opacity="0.4"
        />
      ))}
    </svg>
  );
}

function BracketColumnHeaders({ cellW, width }) {
  return (
    <div
      className="mb-1 grid"
      style={{
        width,
        gridTemplateColumns: `repeat(${BRACKET_GRID_COLS}, ${cellW}px)`,
      }}
    >
      {Array.from({ length: BRACKET_GRID_COLS }, (_, i) => {
        const col = i + 1;
        const label = BRACKET_COLUMN_LABELS[col];
        return (
          <div
            key={col}
            className="px-1 pb-2 text-center text-[10px] font-semibold uppercase tracking-wide text-primary sm:text-xs"
          >
            {label}
          </div>
        );
      })}
    </div>
  );
}

export default function KnockoutBracket({ phases }) {
  const containerRef = useRef(null);
  const { cellW, cellH, width, height } = useBracketDimensions(containerRef);

  if (!phases?.length) {
    return (
      <p className="text-sm text-muted-foreground">
        La fase final todavía no tiene partidos publicados en la API.
      </p>
    );
  }

  if (!isOfficialKnockoutBracket(phases)) {
    return <KnockoutSection phases={phases} />;
  }

  const matchById = indexKnockoutMatches(phases);

  return (
    <div ref={containerRef} className="w-full overflow-x-auto">
      <div style={{ width, minWidth: '100%' }}>
        <BracketColumnHeaders cellW={cellW} width={width} />
        <div className="relative" style={{ width, height, minHeight: height }}>
          <BracketConnectors cellW={cellW} cellH={cellH} width={width} height={height} />
          <div
            className="relative grid h-full"
            style={{
              width,
              gridTemplateColumns: `repeat(${BRACKET_GRID_COLS}, ${cellW}px)`,
              gridTemplateRows: `repeat(${BRACKET_GRID_ROWS}, ${cellH}px)`,
            }}
          >
            {Object.entries(BRACKET_NODES).map(([id, node]) => {
              const match = matchById.get(id);
              const isFinal = node.round === 'final';
              return (
                <div
                  key={id}
                  className="flex min-h-0 items-center px-0.5 py-0.5"
                  style={{
                    gridColumn: node.col,
                    gridRow: `${node.rowStart} / span ${node.rowSpan}`,
                  }}
                >
                  {match ? (
                    <BracketMatchCell match={match} highlight={isFinal} />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center rounded-md border border-dashed border-border/60 bg-muted/20 px-2 text-center text-xs text-primary/70">
                      #{id}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
