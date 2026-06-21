import { eventHasPitchCoords } from '@/lib/pitchCoordinates.js';
import { filterTimelineForDisplay } from '@/lib/matchTimelineDisplay.js';
import {
  buildAttackHeatmapCells,
  buildHeatmapCells,
  heatmapIntensityToColor,
  HEATMAP_GRID_COLS,
  HEATMAP_GRID_ROWS,
} from '@/lib/eventHeatmap.js';

export default function PitchHeatmapLayer({ events = [], heatmapMode = 'shots', className }) {
  if (!heatmapMode) return null;

  const filtered = filterTimelineForDisplay(events).filter(eventHasPitchCoords);
  const isAttackOverlay = heatmapMode === 'normal';
  const cells = isAttackOverlay
    ? buildAttackHeatmapCells(filtered)
    : buildHeatmapCells(filtered, heatmapMode);
  if (!cells.length) return null;

  return (
    <div className={`pointer-events-none absolute inset-0 z-[1] ${className ?? ''}`} aria-hidden>
      <svg
        className={isAttackOverlay ? 'h-full w-full scale-[1.06] blur-[7px]' : 'h-full w-full'}
        viewBox={`0 0 ${HEATMAP_GRID_COLS} ${HEATMAP_GRID_ROWS}`}
        preserveAspectRatio="none"
      >
        {cells.map((cell) => (
          <rect
            key={`${isAttackOverlay ? 'attack' : heatmapMode}-${cell.side}-${cell.col}-${cell.row}`}
            x={cell.col}
            y={cell.row}
            width={1}
            height={1}
            fill={heatmapIntensityToColor(cell.intensity, cell.side)}
            opacity={isAttackOverlay ? 0.24 + cell.intensity * 0.32 : 0.45 + cell.intensity * 0.4}
          />
        ))}
      </svg>
    </div>
  );
}

export function heatmapEventsWithoutCoords(events = [], heatmapMode = 'shots') {
  if (!heatmapMode || heatmapMode === 'normal') return 0;
  const filtered = filterTimelineForDisplay(events);
  const withCoords = filtered.filter(eventHasPitchCoords);
  const totalForMode = withCoords.length;
  return Math.max(0, filtered.length - totalForMode);
}
