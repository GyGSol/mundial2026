import {
  eventHasPitchCoords,
  getPitchEventFifaCoords,
  HEATMAP_EVENT_TYPES,
  isInAttackingThird,
} from '@/lib/pitchCoordinates.js';

export const HEATMAP_GRID_COLS = 12;
export const HEATMAP_GRID_ROWS = 8;

/** Pesos del mapa de ataque en vista Normal (goles > tiros > faltas/tarjetas). */
export const ATTACK_HEATMAP_WEIGHTS = {
  goal: 1,
  shot_attempt: 0.68,
  foul: 0.42,
  yellow_card: 0.42,
  red_card: 0.42,
};

/** Parámetros del overlay de ataque (Normal): zonas más amplias y fusionadas. */
export const ATTACK_HEATMAP_SIGMA = 2.35;
export const ATTACK_HEATMAP_CELL_CUTOFF = 0.02;
/** <1 expande tonos medios → manchas más grandes y visibles. */
export const ATTACK_HEATMAP_INTENSITY_GAMMA = 0.68;

function eventAttackWeight(event) {
  return ATTACK_HEATMAP_WEIGHTS[event?.type] ?? 0;
}

function shouldIncludeInAttackHeatmap(event) {
  const weight = eventAttackWeight(event);
  if (weight <= 0) return false;

  const isFoulType =
    event?.type === 'foul' || event?.type === 'yellow_card' || event?.type === 'red_card';
  if (!isFoulType) return true;

  const coords = getPitchEventFifaCoords(event);
  if (!coords) return false;
  return isInAttackingThird(event.side, coords.x);
}

function eventMatchesHeatmapMode(event, mode) {
  const types = HEATMAP_EVENT_TYPES[mode];
  return types?.has(event?.type) ?? false;
}

function gaussianKernel(dx, dy, sigma = 1.2) {
  return Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
}

function emptyGrid() {
  return Array.from({ length: HEATMAP_GRID_ROWS }, () =>
    Array.from({ length: HEATMAP_GRID_COLS }, () => 0)
  );
}

function accumulateEventOnGrid(grid, event, weight = 1, sigma = 1.2) {
  const coords = getPitchEventFifaCoords(event);
  if (!coords || weight <= 0) return;

  const centerCol = (coords.x / 100) * (HEATMAP_GRID_COLS - 1);
  const centerRow = (coords.y / 100) * (HEATMAP_GRID_ROWS - 1);

  for (let row = 0; row < HEATMAP_GRID_ROWS; row += 1) {
    for (let col = 0; col < HEATMAP_GRID_COLS; col += 1) {
      grid[row][col] += gaussianKernel(col - centerCol, row - centerRow, sigma) * weight;
    }
  }
}

function gridToCells(grid, side, { cutoff = 0.05, intensityGamma = 1 } = {}) {
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
      if (raw <= cutoff) continue;
      cells.push({
        row,
        col,
        intensity: Math.pow(raw / max, intensityGamma),
        side,
      });
    }
  }

  return cells;
}

function buildSideHeatmapCells(events = [], mode = 'shots', side = 'home') {
  const grid = emptyGrid();
  const relevant = events.filter(
    (event) =>
      event?.side === side &&
      eventHasPitchCoords(event) &&
      eventMatchesHeatmapMode(event, mode)
  );

  for (const event of relevant) {
    accumulateEventOnGrid(grid, event);
  }

  return gridToCells(grid, side);
}

/** Mapas de calor por equipo en posición FIFA real (local izquierda, visitante derecha). */
export function buildHeatmapCells(events = [], mode = 'shots') {
  return [
    ...buildSideHeatmapCells(events, mode, 'home'),
    ...buildSideHeatmapCells(events, mode, 'away'),
  ];
}

function buildSideAttackHeatmapCells(events = [], side = 'home') {
  const grid = emptyGrid();
  const relevant = events.filter(
    (event) =>
      event?.side === side &&
      eventHasPitchCoords(event) &&
      shouldIncludeInAttackHeatmap(event)
  );

  for (const event of relevant) {
    accumulateEventOnGrid(grid, event, eventAttackWeight(event), ATTACK_HEATMAP_SIGMA);
  }

  return gridToCells(grid, side, {
    cutoff: ATTACK_HEATMAP_CELL_CUTOFF,
    intensityGamma: ATTACK_HEATMAP_INTENSITY_GAMMA,
  });
}

/** Vista Normal: suma ponderada de goles + tiros + faltas (ataque por equipo). */
export function buildAttackHeatmapCells(events = []) {
  return [
    ...buildSideAttackHeatmapCells(events, 'home'),
    ...buildSideAttackHeatmapCells(events, 'away'),
  ];
}

/** Valor máximo de la grilla ponderada (tests y diagnóstico). */
export function peakAttackGridValue(events = [], side = 'home') {
  const grid = emptyGrid();
  const relevant = events.filter(
    (event) =>
      event?.side === side &&
      eventHasPitchCoords(event) &&
      shouldIncludeInAttackHeatmap(event)
  );

  for (const event of relevant) {
    accumulateEventOnGrid(grid, event, eventAttackWeight(event), ATTACK_HEATMAP_SIGMA);
  }

  let max = 0;
  for (const row of grid) {
    for (const value of row) {
      if (value > max) max = value;
    }
  }
  return max;
}

export function heatmapIntensityToColor(intensity, side = 'home') {
  const t = Math.min(1, Math.max(0, intensity));

  if (side === 'away') {
    const r = Math.round(120 + 135 * t);
    const g = Math.round(24 + 36 * (1 - t));
    const b = Math.round(46 + 54 * (1 - t));
    return `rgb(${r}, ${g}, ${b})`;
  }

  const r = Math.round(14 + 40 * (1 - t));
  const g = Math.round(72 + 118 * t);
  const b = Math.round(120 + 135 * t);
  return `rgb(${r}, ${g}, ${b})`;
}

export function countHeatmapEligibleEvents(events = [], mode = 'shots') {
  return events.filter(
    (event) => eventHasPitchCoords(event) && eventMatchesHeatmapMode(event, mode)
  ).length;
}
