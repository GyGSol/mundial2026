import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import MatchTeamSide from '@/components/worldcup/MatchTeamSide.jsx';
import { KnockoutSection } from '@/components/worldcup/WorldCupSections.jsx';
import {
  BRACKET_GRID_COLS,
  BRACKET_GRID_ROWS,
  BRACKET_NODES,
  getBracketConnectors,
  getNodeCenter,
  indexKnockoutMatches,
  isOfficialKnockoutBracket,
} from '@/lib/worldCupBracketLayout.js';

const CELL_W = 92;
const CELL_H = 32;

const ROUND_LABELS = {
  r32: '32',
  r16: '16',
  qf: 'CF',
  sf: 'SF',
  final: 'Final',
  third: '3°',
};

function nodeCenterPx(node) {
  const center = getNodeCenter(node);
  return {
    x: (center.col - 1) * CELL_W + CELL_W / 2,
    y: (center.row - 1) * CELL_H + CELL_H / 2,
  };
}

function buildConnectorPath(fromId, toId) {
  const fromNode = BRACKET_NODES[fromId];
  const toNode = BRACKET_NODES[toId];
  if (!fromNode || !toNode) return '';

  const from = nodeCenterPx(fromNode);
  const to = nodeCenterPx(toNode);
  const fromEdgeX = from.x + (to.x >= from.x ? CELL_W * 0.28 : -CELL_W * 0.28);
  const toEdgeX = to.x + (to.x >= from.x ? -CELL_W * 0.28 : CELL_W * 0.28);
  const midX = (fromEdgeX + toEdgeX) / 2;

  return `M ${fromEdgeX} ${from.y} H ${midX} V ${to.y} H ${toEdgeX}`;
}

function BracketMatchCell({ match, highlight = false }) {
  const isLive = match?.status === 'live';
  const isFinished = match?.status === 'finished';
  const homeTitle = match?.homeTeam?.nameEn || match?.homeTeamSlotLabel || 'Por definir';
  const awayTitle = match?.awayTeam?.nameEn || match?.awayTeamSlotLabel || 'Por definir';

  const scoreText = isFinished || isLive
    ? `${match.homeScore}-${match.awayScore}`
    : 'vs';

  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-0.5 rounded border bg-card px-1.5 py-1 text-[10px] leading-tight',
        highlight ? 'border-primary/60 ring-1 ring-primary/20' : 'border-border/70',
        isLive && 'border-emerald-400/70 bg-emerald-50/40'
      )}
      title={`Partido ${match?.externalId ?? ''}: ${homeTitle} vs ${awayTitle}`}
    >
      <div className="flex items-center justify-between gap-1">
        <MatchTeamSide
          team={match?.homeTeam}
          slotLabel={match?.homeTeamSlotLabel}
          compact
        />
        <span
          className={cn(
            'shrink-0 font-semibold tabular-nums',
            isLive ? 'text-emerald-700' : 'text-muted-foreground'
          )}
        >
          {scoreText}
        </span>
      </div>
      <MatchTeamSide
        team={match?.awayTeam}
        slotLabel={match?.awayTeamSlotLabel}
        compact
      />
      {match?.externalId && (
        <span className="text-[8px] text-muted-foreground/80">#{match.externalId}</span>
      )}
    </div>
  );
}

function BracketConnectors() {
  const paths = useMemo(() => {
    return getBracketConnectors().map(({ from, to }) => ({
      id: `${from}-${to}`,
      d: buildConnectorPath(from, to),
    }));
  }, []);

  const width = BRACKET_GRID_COLS * CELL_W;
  const height = BRACKET_GRID_ROWS * CELL_H;

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
          strokeWidth="1"
          opacity="0.45"
        />
      ))}
    </svg>
  );
}

export default function KnockoutBracket({ phases }) {
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
  const width = BRACKET_GRID_COLS * CELL_W;
  const height = BRACKET_GRID_ROWS * CELL_H;

  return (
    <div
      className="relative mx-auto"
      style={{ width, height, minWidth: width, minHeight: height }}
    >
      <BracketConnectors />
      <div
        className="relative grid h-full w-full"
        style={{
          gridTemplateColumns: `repeat(${BRACKET_GRID_COLS}, ${CELL_W}px)`,
          gridTemplateRows: `repeat(${BRACKET_GRID_ROWS}, ${CELL_H}px)`,
        }}
      >
        {Object.entries(BRACKET_NODES).map(([id, node]) => {
          const match = matchById.get(id);
          const isFinal = node.round === 'final';
          return (
            <div
              key={id}
              className="flex items-center px-0.5"
              style={{
                gridColumn: node.col,
                gridRow: `${node.rowStart} / span ${node.rowSpan}`,
              }}
            >
              {match ? (
                <BracketMatchCell match={match} highlight={isFinal} />
              ) : (
                <div className="w-full rounded border border-dashed border-border/60 bg-muted/20 px-1.5 py-1 text-center text-[10px] text-muted-foreground">
                  #{id}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap justify-center gap-3 text-[9px] text-muted-foreground">
        {Object.entries(ROUND_LABELS).map(([key, label]) => (
          <span key={key}>{label}</span>
        ))}
      </div>
    </div>
  );
}
