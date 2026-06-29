import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { ARGENTINA_TIMEZONE, formatMatchDate } from '@/lib/dateFormat';
import { getTeamFlag } from '@/lib/teamMeta';
import { KnockoutSlotLabel } from '@/components/worldcup/GroupColorUi.jsx';
import { getGroupColor, parseKnockoutSlotLabel } from '@/lib/groupColors.js';
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
import { resolveFieldMatchScores, resolveKnockoutDisplayWinner } from '@/lib/matchDisplayScore.js';
import { PenaltyShootoutScoreLine } from '@/components/PenaltyShootoutDisplay.jsx';

const MIN_CELL_W = 108;
/** Dieciseisavos ocupan 2 filas; con el estilo completo hace falta más alto que 64px. */
const MIN_CELL_H = 90;
const FINAL_COLUMN = 5;
const CENTER_MATCH_IDS = new Set(['103', '104']);

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

function BracketCountryLine({ team, slotLabel, slotSourceMatch, score, isWinner, isLive }) {
  const flagUrl = team ? getTeamFlag(team) : null;
  const title = team?.nameEn || team?.fifaCode || slotLabel || 'Por definir';
  const parsed = !team && slotLabel ? parseKnockoutSlotLabel(slotLabel) : null;
  const accentColor =
    parsed?.type === 'group_position'
      ? getGroupColor(parsed.group, parsed.position)
      : null;

  return (
    <div
      className={cn(
        'flex w-full min-w-0 items-center justify-center gap-1.5 px-1',
        accentColor && 'border-l-[3px] border-solid',
        isWinner && 'font-bold',
        isLive && !isWinner && 'opacity-90'
      )}
      style={accentColor ? { borderLeftColor: accentColor } : undefined}
      title={title}
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
      {team ? (
        <span
          className={cn(
            'min-w-0 text-center text-[11px] leading-tight text-primary sm:text-xs',
            isWinner && 'font-bold'
          )}
        >
          {team.nameEn || team.fifaCode}
        </span>
      ) : slotLabel || slotSourceMatch ? (
        <KnockoutSlotLabel
          label={slotLabel}
          slotSourceMatch={slotSourceMatch}
          className="min-w-0 text-[10px] font-medium text-primary sm:text-[11px]"
        />
      ) : (
        <span className="text-[11px] text-muted-foreground sm:text-xs">Por definir</span>
      )}
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

function BracketMatchMeta({ match }) {
  const dateTime = formatMatchDate(match, { showTimezone: true, timeZone: ARGENTINA_TIMEZONE });
  const stadiumLine = [match?.stadium?.nameEn, match?.stadium?.city].filter(Boolean).join(' · ');

  if (!dateTime && !stadiumLine) return null;

  return (
    <div className="mb-1.5 w-full space-y-0.5 border-b border-border/40 pb-1.5 text-center text-[9px] leading-snug text-primary/75 sm:text-[10px]">
      {dateTime ? <p>{dateTime}</p> : null}
      {stadiumLine ? (
        <p className="truncate px-0.5" title={stadiumLine}>
          {stadiumLine}
        </p>
      ) : null}
    </div>
  );
}

function BracketMatchCell({ match, highlight = false }) {
  const isLive = match?.status === 'live';
  const isFinished = match?.status === 'finished';
  const hasScore = isFinished || isLive;
  const { homeScore, awayScore } = resolveFieldMatchScores(match);
  const winnerSide = hasScore ? resolveKnockoutDisplayWinner(match) : null;

  const homeTitle = match?.homeTeam?.nameEn || match?.homeTeamSlotLabel || 'Por definir';
  const awayTitle = match?.awayTeam?.nameEn || match?.awayTeamSlotLabel || 'Por definir';

  const homeWinner = winnerSide === 'home';
  const awayWinner = winnerSide === 'away';

  return (
    <div
      className={cn(
        'flex h-full w-full min-h-0 min-w-0 flex-col items-center justify-center gap-0.5 rounded-md border bg-card px-1.5 py-2 shadow-sm',
        highlight ? 'border-primary/60 ring-1 ring-primary/20' : 'border-border/70',
        isLive && 'border-emerald-400/70 bg-emerald-50/30'
      )}
      title={`${homeTitle} vs ${awayTitle}`}
    >
      <BracketMatchMeta match={match} />

      <BracketCountryLine
        team={match?.homeTeam}
        slotLabel={match?.homeTeamSlotLabel}
        slotSourceMatch={match?.homeTeamSlotSourceMatch}
        score={hasScore ? homeScore : null}
        isWinner={homeWinner}
        isLive={isLive}
      />

      <span className="text-[10px] font-semibold uppercase tracking-wide text-primary/70">vs</span>

      <BracketCountryLine
        team={match?.awayTeam}
        slotLabel={match?.awayTeamSlotLabel}
        slotSourceMatch={match?.awayTeamSlotSourceMatch}
        score={hasScore ? awayScore : null}
        isWinner={awayWinner}
        isLive={isLive}
      />

      {hasScore ? (
        <PenaltyShootoutScoreLine penaltyShootout={match.penaltyShootout} className="text-[9px]" />
      ) : null}
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

function BracketCenterColumn({ cellW, height, finalMatch, thirdMatch }) {
  const centerY = height / 2;

  return (
    <div
      className="pointer-events-none absolute z-10"
      style={{
        left: (FINAL_COLUMN - 1) * cellW,
        width: cellW,
        top: 0,
        height,
      }}
    >
      <div
        className="absolute flex w-full flex-col items-center justify-center px-1"
        style={{
          top: centerY,
          left: 0,
          transform: 'translateY(-50%)',
        }}
      >
        <img
          src="/world-cup-trophy.png"
          alt="Copa del Mundo FIFA"
          className="pointer-events-none mb-1 h-14 w-auto max-w-full object-contain drop-shadow-md sm:h-[4.25rem]"
          draggable={false}
        />
        <span className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-primary sm:text-xs">
          Final
        </span>
        {finalMatch ? (
          <div className="pointer-events-auto w-full">
            <BracketMatchCell match={finalMatch} highlight />
          </div>
        ) : null}
        {thirdMatch ? (
          <div className="pointer-events-auto mt-2 w-full">
            <BracketMatchCell match={thirdMatch} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function BracketColumnHeaders({ cellW, width }) {
  return (
    <div
      className="mb-1 grid shrink-0"
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
            {col === FINAL_COLUMN ? '' : label}
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
  const finalMatch = matchById.get('104');
  const thirdMatch = matchById.get('103');

  return (
    <div
      ref={containerRef}
      className="max-w-full overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]"
    >
      <div className="w-max min-w-full" style={{ width }}>
        <BracketColumnHeaders cellW={cellW} width={width} />
        <div className="relative" style={{ width, height, minHeight: height }}>
          <BracketConnectors cellW={cellW} cellH={cellH} width={width} height={height} />
          <BracketCenterColumn
            cellW={cellW}
            height={height}
            finalMatch={finalMatch}
            thirdMatch={thirdMatch}
          />
          <div
            className="relative grid h-full shrink-0"
            style={{
              width,
              gridTemplateColumns: `repeat(${BRACKET_GRID_COLS}, ${cellW}px)`,
              gridTemplateRows: `repeat(${BRACKET_GRID_ROWS}, ${cellH}px)`,
            }}
          >
            {Object.entries(BRACKET_NODES).map(([id, node]) => {
              if (CENTER_MATCH_IDS.has(id)) return null;

              const match = matchById.get(id);
              return (
                <div
                  key={id}
                  className="flex h-full min-h-0 items-stretch px-0.5 py-0.5"
                  style={{
                    gridColumn: node.col,
                    gridRow: `${node.rowStart} / span ${node.rowSpan}`,
                  }}
                >
                  {match ? (
                    <BracketMatchCell match={match} />
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
