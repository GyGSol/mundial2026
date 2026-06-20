import { HEATMAP_EVENT_TYPES } from '@/lib/pitchCoordinates.js';

export const HEATMAP_GRID_COLS = 12;
export const HEATMAP_GRID_ROWS = 8;

function eventMatchesHeatmapMode(event, mode) {
  const types = HEATMAP_EVENT_TYPES[mode];
  return types?.has(event?.type) ?? false;
}

function gaussianKernel(dx, dy, sigma = 1.2) {
  return Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
}

/** Agrupa eventos con coords en celdas con kernel gaussiano simple. */
export function buildHeatmapCells(events = [], mode = 'shots') {
  const grid = Array.from({ length: HEATMAP_GRID_ROWS }, () =>
    Array.from({ length: HEATMAP_GRID_COLS }, () => 0)
  );

  const relevant = events.filter((event) => eventMatchesHeatmapMode(event, mode));
  if (!relevant.length) return [];

  for (const event of relevant) {
    const x = Number(event.positionX);
    const y = Number(event.positionY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

    const centerCol = (x / 100) * (HEATMAP_GRID_COLS - 1);
    const centerRow = (y / 100) * (HEATMAP_GRID_ROWS - 1);

    for (let row = 0; row < HEATMAP_GRID_ROWS; row += 1) {
      for (let col = 0; col < HEATMAP_GRID_COLS; col += 1) {
        const weight = gaussianKernel(col - centerCol, row - centerRow);
        grid[row][col] += weight;
      }
    }
  }

  let max = 0;
  for (const row of grid) {
    for (const value of row) {
      if (value > max) max = value;
    }
  }
  if (max <= 0) return [];

  const cells = [];
  for (let row = 0; row < HEATMAP_GRID_ROWS; row += 1) {
    for (let col = 0; col < HEATMAP_GRID_COLS; col += 1) {
      const raw = grid[row][col];
      if (raw <= 0.05) continue;
      cells.push({
        row,
        col,
        intensity: raw / max,
      });
    }
  }

  return cells;
}

export function heatmapIntensityToColor(intensity) {
  const t = Math.min(1, Math.max(0, intensity));
  const r = Math.round(255 * t);
  const g = Math.round(40 + 120 * (1 - t));
  const b = Math.round(80 * (1 - t));
  return `rgb(${r}, ${g}, ${b})`;
}

export function countHeatmapEligibleEvents(events = [], mode = 'shots') {
  return events.filter((event) => eventMatchesHeatmapMode(event, mode)).length;
}
