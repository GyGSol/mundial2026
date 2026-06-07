import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import MatchTeamSide from '@/components/worldcup/MatchTeamSide.jsx';
import { KnockoutSection } from '@/components/worldcup/WorldCupSections.jsx';
import {
  BRACKET_COLUMN_LABELS,
  BRACKET_GRID_COLS,
  BRACKET_GRID_ROWS,
  BRACKET_NODES,
  ROUND_TITLES,
  getBracketConnectors,
  getNodeCenter,
  indexKnockoutMatches,
  isOfficialKnockoutBracket,
} from '@/lib/worldCupBracketLayout.js';

const MIN_CELL_W = 108;
const MIN_CELL_H = 72;

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

  const cellH = Math.max(MIN_CELL_H, Math.round(cellW * 0.78));
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

function BracketTeamRow({ team, slotLabel, score, isWinner, isLive }) {
  return (
    <div
      className={cn(
        'flex min-w-0 items-center gap-1 rounded-sm px-1 py-0.5',
        isWinner && 'bg-primary/10 font-semibold',
        isLive && !isWinner && 'bg-emerald-50/50'
      )}
    >
      <MatchTeamSide team={team} slotLabel={slotLabel} bracket />
      {score != null ? (
        <span
          className={cn(
            'shrink-0 min-w-[1.25rem] text-right text-xs font-bold tabular-nums sm:text-sm',
            isWinner ? 'text-primary' : 'text-muted-foreground'
          )}
        >
          {score}
        </span>
      ) : null}
    </div>
  );
}

function BracketMatchCell({ match, round, highlight = false }) {
  const isLive = match?.status === 'live';
  const isFinished = match?.status === 'finished';
  const hasScore = isFinished || isLive;

  const homeTitle = match?.homeTeam?.nameEn || match?.homeTeamSlotLabel || 'Por definir';
  const awayTitle = match?.awayTeam?.nameEn || match?.awayTeamSlotLabel || 'Por definir';
  const roundLabel = ROUND_TITLES[round] || round;

  const homeWinner = hasScore && match.homeScore > match.awayScore;
  const awayWinner = hasScore && match.awayScore > match.homeScore;

  return (
    <div
      className={cn(
        'flex w-full min-w-0 flex-col gap-1 rounded-md border bg-card p-2 shadow-sm',
        highlight ? 'border-primary/60 ring-1 ring-primary/20' : 'border-border/70',
        isLive && 'border-emerald-400/70 bg-emerald-50/30'
      )}
      title={`Partido ${match?.externalId ?? ''}: ${homeTitle} vs ${awayTitle}`}
    >
      <div className="flex items-center justify-between gap-1 border-b border-border/40 pb-1">
        <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {roundLabel}
        </span>
        {match?.externalId ? (
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">#{match.externalId}</span>
        ) : null}
      </div>

      <BracketTeamRow
        team={match?.homeTeam}
        slotLabel={match?.homeTeamSlotLabel}
        score={hasScore ? match.homeScore : null}
        isWinner={homeWinner}
        isLive={isLive}
      />
      <BracketTeamRow
        team={match?.awayTeam}
        slotLabel={match?.awayTeamSlotLabel}
        score={hasScore ? match.awayScore : null}
        isWinner={awayWinner}
        isLive={isLive}
      />

      {!hasScore && (
        <span className="text-center text-[10px] font-medium text-muted-foreground/80">vs</span>
      )}
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
            className="px-1 pb-2 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs"
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
        <div
          className="relative"
          style={{ width, height, minHeight: height }}
        >
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
                className="flex items-center px-1"
                style={{
                  gridColumn: node.col,
                  gridRow: `${node.rowStart} / span ${node.rowSpan}`,
                }}
              >
                {match ? (
                  <BracketMatchCell match={match} round={node.round} highlight={isFinal} />
                ) : (
                  <div className="w-full rounded-md border border-dashed border-border/60 bg-muted/20 px-2 py-3 text-center text-xs text-muted-foreground">
                    Partido #{id}
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
