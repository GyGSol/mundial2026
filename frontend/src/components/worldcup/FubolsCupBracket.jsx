import { cn } from '@/lib/utils';
import {
  FUBOLS_CUP_BRACKET_COLS,
  FUBOLS_CUP_BRACKET_NODES,
  FUBOLS_CUP_BRACKET_ROWS,
  getFubolsCupConnectors,
  getFubolsCupNodeCenter,
  duelNodeId,
} from '@/lib/fubolsCupBracketLayout.js';

const MIN_CELL_W = 120;
const MIN_CELL_H = 72;

function nodeCenterPx(node, cellW, cellH) {
  const center = getFubolsCupNodeCenter(node);
  return {
    x: (center.col - 1) * cellW + cellW / 2,
    y: (center.row - 1) * cellH + cellH / 2,
  };
}

function buildConnectorPath(fromId, toId, cellW, cellH) {
  const fromNode = FUBOLS_CUP_BRACKET_NODES[fromId];
  const toNode = FUBOLS_CUP_BRACKET_NODES[toId];
  if (!fromNode || !toNode) return '';

  const from = nodeCenterPx(fromNode, cellW, cellH);
  const to = nodeCenterPx(toNode, cellW, cellH);
  const fromEdgeX = from.x + (to.x >= from.x ? cellW * 0.28 : -cellW * 0.28);
  const toEdgeX = to.x + (to.x >= from.x ? -cellW * 0.28 : cellW * 0.28);
  const midX = (fromEdgeX + toEdgeX) / 2;

  return `M ${fromEdgeX} ${from.y} H ${midX} V ${to.y} H ${toEdgeX}`;
}

function formatMatchScores(matchResults) {
  if (!matchResults?.length) return null;
  return matchResults.map((row) => `${row.pointsA}-${row.pointsB}`).join(' · ');
}

function DuelCard({ duel, isWinnerSide, side }) {
  const player = side === 'A' ? duel.playerA : duel.playerB;
  if (!player?.name) {
    return <span className="text-xs text-muted-foreground">Por definir</span>;
  }

  const won =
    duel.winnerId && player.id === duel.winnerId ? true : duel.winnerId ? false : null;

  return (
    <div
      className={cn(
        'flex flex-col gap-0.5 rounded-md border px-2 py-1.5 text-xs',
        won === true && 'border-primary bg-primary/10 font-semibold',
        won === false && 'opacity-70'
      )}
    >
      <span className="truncate" title={player.name}>
        {player.seed ? `${player.seed}. ` : ''}
        {player.name}
      </span>
      {isWinnerSide && duel.matchResults?.length ? (
        <span className="font-mono text-[10px] text-muted-foreground">
          {formatMatchScores(duel.matchResults)}
        </span>
      ) : null}
    </div>
  );
}

function DuelNode({ duel, nodeId, cellW, cellH }) {
  const node = FUBOLS_CUP_BRACKET_NODES[nodeId];
  if (!node || !duel) return null;

  const top = (node.rowStart - 1) * cellH;
  const height = node.rowSpan * cellH;
  const left = (node.col - 1) * cellW;

  return (
    <div
      className="absolute px-1"
      style={{ left, top, width: cellW, height, display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'center' }}
    >
      <DuelCard duel={duel} side="A" isWinnerSide />
      <DuelCard duel={duel} side="B" isWinnerSide />
    </div>
  );
}

export default function FubolsCupBracket({ rounds = [] }) {
  const cellW = MIN_CELL_W;
  const cellH = MIN_CELL_H;
  const width = FUBOLS_CUP_BRACKET_COLS * cellW;
  const height = FUBOLS_CUP_BRACKET_ROWS * cellH;
  const connectors = getFubolsCupConnectors();

  return (
    <div className="overflow-x-auto rounded-lg border bg-card/40 p-2">
      <div className="relative mx-auto" style={{ width, height, minWidth: width }}>
        <svg
          className="pointer-events-none absolute inset-0 text-border"
          width={width}
          height={height}
          aria-hidden
        >
          {connectors.map(({ from, to }) => (
            <path
              key={`${from}-${to}`}
              d={buildConnectorPath(from, to, cellW, cellH)}
              fill="none"
              stroke="currentColor"
              strokeWidth={1}
            />
          ))}
        </svg>
        {rounds.map((round, roundIndex) =>
          round.duels.map((duel, duelIndex) => (
            <DuelNode
              key={duel.duelId}
              duel={duel}
              nodeId={duelNodeId(roundIndex, duelIndex)}
              cellW={cellW}
              cellH={cellH}
            />
          ))
        )}
      </div>
    </div>
  );
}
