/**
 * Plantillas de cuadrícula táctica (PDF Dataset_Formaciones_Futbol + variantes frecuentes).
 * gridX: profundidad 0=arco propio, 100=medio campo (perspectiva del equipo).
 * gridY: lateral 0=banda izq. del equipo, 100=banda der.
 */

/** Alineado con LATERAL_SLOTS de formationLayout (línea de 4: 12–28–72–88). */
export const LATERAL = {
  WING_L: 12,
  INNER_L: 28,
  CENTER: 50,
  INNER_R: 72,
  WING_R: 88,
};

export const DEPTH = {
  GK: 6,
  DEF: 30,
  MID_LOW: 52,
  MID: 58,
  MID_HIGH: 64,
  ATT: 85,
};

/** @typedef {{ id: string, role: string, gridX: number, gridY: number }} PitchGridCell */

/** @type {Record<string, PitchGridCell[]>} */
export const FORMATION_GRID_TEMPLATES = {
  '4-3-3': [
    { id: 'gk', role: 'POR', gridX: DEPTH.GK, gridY: LATERAL.CENTER },
    { id: 'd1', role: 'LI', gridX: DEPTH.DEF, gridY: LATERAL.WING_L },
    { id: 'd2', role: 'DFC', gridX: DEPTH.DEF, gridY: LATERAL.INNER_L },
    { id: 'd3', role: 'DFC', gridX: DEPTH.DEF, gridY: LATERAL.INNER_R },
    { id: 'd4', role: 'LD', gridX: DEPTH.DEF, gridY: LATERAL.WING_R },
    { id: 'm1', role: 'MC', gridX: DEPTH.MID, gridY: LATERAL.INNER_L },
    { id: 'm2', role: 'MCD', gridX: DEPTH.MID, gridY: LATERAL.CENTER },
    { id: 'm3', role: 'MC', gridX: DEPTH.MID, gridY: LATERAL.INNER_R },
    { id: 'f1', role: 'EI', gridX: DEPTH.ATT, gridY: LATERAL.WING_L },
    { id: 'f2', role: 'DC', gridX: DEPTH.ATT, gridY: LATERAL.CENTER },
    { id: 'f3', role: 'ED', gridX: DEPTH.ATT, gridY: LATERAL.WING_R },
  ],
  '4-4-2': [
    { id: 'gk', role: 'POR', gridX: DEPTH.GK, gridY: LATERAL.CENTER },
    { id: 'd1', role: 'LI', gridX: DEPTH.DEF, gridY: LATERAL.WING_L },
    { id: 'd2', role: 'DFC', gridX: DEPTH.DEF, gridY: LATERAL.INNER_L },
    { id: 'd3', role: 'DFC', gridX: DEPTH.DEF, gridY: LATERAL.INNER_R },
    { id: 'd4', role: 'LD', gridX: DEPTH.DEF, gridY: LATERAL.WING_R },
    { id: 'm1', role: 'MI', gridX: DEPTH.MID, gridY: LATERAL.WING_L },
    { id: 'm2', role: 'MC', gridX: DEPTH.MID, gridY: LATERAL.INNER_L },
    { id: 'm3', role: 'MC', gridX: DEPTH.MID, gridY: LATERAL.INNER_R },
    { id: 'm4', role: 'MD', gridX: DEPTH.MID, gridY: LATERAL.WING_R },
    { id: 'f1', role: 'DC', gridX: DEPTH.ATT, gridY: LATERAL.INNER_L },
    { id: 'f2', role: 'DC', gridX: DEPTH.ATT, gridY: LATERAL.INNER_R },
  ],
  '4-2-3-1': [
    { id: 'gk', role: 'POR', gridX: DEPTH.GK, gridY: LATERAL.CENTER },
    { id: 'd1', role: 'LI', gridX: DEPTH.DEF, gridY: LATERAL.WING_L },
    { id: 'd2', role: 'DFC', gridX: DEPTH.DEF, gridY: LATERAL.INNER_L },
    { id: 'd3', role: 'DFC', gridX: DEPTH.DEF, gridY: LATERAL.INNER_R },
    { id: 'd4', role: 'LD', gridX: DEPTH.DEF, gridY: LATERAL.WING_R },
    { id: 'm1', role: 'MCD', gridX: DEPTH.MID_LOW, gridY: LATERAL.INNER_L },
    { id: 'm2', role: 'MCD', gridX: DEPTH.MID_LOW, gridY: LATERAL.INNER_R },
    { id: 'm3', role: 'MI', gridX: DEPTH.MID_HIGH, gridY: LATERAL.WING_L },
    { id: 'm4', role: 'MCO', gridX: DEPTH.MID_HIGH, gridY: LATERAL.CENTER },
    { id: 'm5', role: 'MD', gridX: DEPTH.MID_HIGH, gridY: LATERAL.WING_R },
    { id: 'f1', role: 'DC', gridX: DEPTH.ATT, gridY: LATERAL.CENTER },
  ],
  '3-5-2': [
    { id: 'gk', role: 'POR', gridX: DEPTH.GK, gridY: LATERAL.CENTER },
    { id: 'd1', role: 'DFC', gridX: DEPTH.DEF, gridY: LATERAL.INNER_L },
    { id: 'd2', role: 'DFC', gridX: DEPTH.DEF, gridY: LATERAL.CENTER },
    { id: 'd3', role: 'DFC', gridX: DEPTH.DEF, gridY: LATERAL.INNER_R },
    { id: 'm1', role: 'CAI', gridX: DEPTH.MID, gridY: LATERAL.WING_L },
    { id: 'm2', role: 'MCD', gridX: DEPTH.MID, gridY: LATERAL.CENTER },
    { id: 'm3', role: 'CAD', gridX: DEPTH.MID, gridY: LATERAL.WING_R },
    { id: 'm4', role: 'MC', gridX: DEPTH.MID_HIGH, gridY: LATERAL.INNER_L },
    { id: 'm5', role: 'MC', gridX: DEPTH.MID_HIGH, gridY: LATERAL.INNER_R },
    { id: 'f1', role: 'DC', gridX: DEPTH.ATT, gridY: LATERAL.INNER_L },
    { id: 'f2', role: 'DC', gridX: DEPTH.ATT, gridY: LATERAL.INNER_R },
  ],
  /** 4+2+3 = 9 campo + GK; el trio ofensivo es MI–MCO–MD y el 9 queda implícito en DC. */
  '4-2-3': [
    { id: 'gk', role: 'POR', gridX: DEPTH.GK, gridY: LATERAL.CENTER },
    { id: 'd1', role: 'LI', gridX: DEPTH.DEF, gridY: LATERAL.WING_L },
    { id: 'd2', role: 'DFC', gridX: DEPTH.DEF, gridY: LATERAL.INNER_L },
    { id: 'd3', role: 'DFC', gridX: DEPTH.DEF, gridY: LATERAL.INNER_R },
    { id: 'd4', role: 'LD', gridX: DEPTH.DEF, gridY: LATERAL.WING_R },
    { id: 'm1', role: 'MCD', gridX: DEPTH.MID_LOW, gridY: LATERAL.INNER_L },
    { id: 'm2', role: 'MCD', gridX: DEPTH.MID_LOW, gridY: LATERAL.INNER_R },
    { id: 'm3', role: 'MI', gridX: DEPTH.MID_HIGH, gridY: LATERAL.WING_L },
    { id: 'm4', role: 'MCO', gridX: DEPTH.MID_HIGH, gridY: LATERAL.CENTER },
    { id: 'm5', role: 'MD', gridX: DEPTH.MID_HIGH, gridY: LATERAL.WING_R },
    { id: 'f1', role: 'DC', gridX: DEPTH.ATT, gridY: LATERAL.CENTER },
  ],
  '4-1-2-3': [
    { id: 'gk', role: 'POR', gridX: DEPTH.GK, gridY: LATERAL.CENTER },
    { id: 'd1', role: 'LI', gridX: DEPTH.DEF, gridY: LATERAL.WING_L },
    { id: 'd2', role: 'DFC', gridX: DEPTH.DEF, gridY: LATERAL.INNER_L },
    { id: 'd3', role: 'DFC', gridX: DEPTH.DEF, gridY: LATERAL.INNER_R },
    { id: 'd4', role: 'LD', gridX: DEPTH.DEF, gridY: LATERAL.WING_R },
    { id: 'm1', role: 'MCD', gridX: DEPTH.MID_LOW, gridY: LATERAL.CENTER },
    { id: 'm2', role: 'MC', gridX: DEPTH.MID, gridY: LATERAL.INNER_L },
    { id: 'm3', role: 'MC', gridX: DEPTH.MID, gridY: LATERAL.INNER_R },
    { id: 'f1', role: 'EI', gridX: DEPTH.ATT, gridY: LATERAL.WING_L },
    { id: 'f2', role: 'DC', gridX: DEPTH.ATT, gridY: LATERAL.CENTER },
    { id: 'f3', role: 'ED', gridX: DEPTH.ATT, gridY: LATERAL.WING_R },
  ],
};

const DEF_ROLES_BY_COUNT = {
  3: ['DFC', 'DFC', 'DFC'],
  4: ['LI', 'DFC', 'DFC', 'LD'],
  5: ['LI', 'DFC', 'DFC', 'DFC', 'LD'],
};

const MID_ROLES_BY_COUNT = {
  1: ['MC'],
  2: ['MCD', 'MC'],
  3: ['MI', 'MC', 'MD'],
  4: ['MI', 'MC', 'MC', 'MD'],
  5: ['CAI', 'MCD', 'CAD', 'MC', 'MC'],
};

const FWD_ROLES_BY_COUNT = {
  1: ['DC'],
  2: ['DC', 'DC'],
  3: ['EI', 'DC', 'ED'],
  4: ['EI', 'DC', 'DC', 'ED'],
};

function lateralForCount(count, index) {
  const slots = {
    1: [LATERAL.CENTER],
    2: [LATERAL.INNER_L, LATERAL.INNER_R],
    3: [LATERAL.WING_L, LATERAL.CENTER, LATERAL.WING_R],
    4: [LATERAL.WING_L, LATERAL.INNER_L, LATERAL.INNER_R, LATERAL.WING_R],
    5: [10, 24, LATERAL.CENTER, 76, 90],
  };
  const row = slots[count] ?? slots[3];
  return row[Math.min(index, row.length - 1)];
}

function depthForRowIndex(rowIndex, totalRows) {
  const presets = {
    4: [DEPTH.GK, DEPTH.DEF, DEPTH.MID, DEPTH.ATT],
    5: [DEPTH.GK, DEPTH.DEF, DEPTH.MID_LOW, DEPTH.MID_HIGH, DEPTH.ATT],
    6: [DEPTH.GK, DEPTH.DEF, DEPTH.MID_LOW, DEPTH.MID, DEPTH.MID_HIGH, DEPTH.ATT],
  };
  const preset = presets[totalRows];
  if (preset?.[rowIndex] != null) return preset[rowIndex];
  if (totalRows <= 1) return DEPTH.MID;
  return DEPTH.GK + (rowIndex / (totalRows - 1)) * (DEPTH.ATT - DEPTH.GK);
}

function rolesForOutfieldRow(count, rowIndex, totalRows) {
  const isLast = rowIndex === totalRows - 1;
  const isFirstOutfield = rowIndex === 1;
  const isGk = rowIndex === 0;

  if (isGk) return ['POR'];
  if (isLast) return FWD_ROLES_BY_COUNT[count] ?? Array.from({ length: count }, () => 'DC');
  if (isFirstOutfield) return DEF_ROLES_BY_COUNT[count] ?? Array.from({ length: count }, () => 'DFC');
  return MID_ROLES_BY_COUNT[count] ?? Array.from({ length: count }, () => 'MC');
}

/**
 * Genera plantilla para formaciones sin entrada PDF explícita.
 * @param {string} formation ej. "3-4-3"
 * @returns {PitchGridCell[]}
 */
export function buildGridTemplateFromFormation(formation) {
  const key = String(formation ?? '').trim();
  if (FORMATION_GRID_TEMPLATES[key]) {
    return FORMATION_GRID_TEMPLATES[key].map((cell) => ({ ...cell }));
  }

  const parts = key
    .split('-')
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n) && n > 0);
  const rows = parts.length ? [1, ...parts] : [1, 4, 3, 3];
  const totalRows = rows.length;
  const cells = [];

  rows.forEach((count, rowIndex) => {
    const depth = depthForRowIndex(rowIndex, totalRows);
    const roles = rolesForOutfieldRow(count, rowIndex, totalRows);
    for (let i = 0; i < count; i += 1) {
      const role = roles[i] ?? roles[roles.length - 1] ?? 'MC';
      const gridY = rowIndex === 0 ? LATERAL.CENTER : lateralForCount(count, i);
      cells.push({
        id: `r${rowIndex}c${i}`,
        role,
        gridX: depth,
        gridY,
      });
    }
  });

  return cells;
}

export function getGridTemplate(formation) {
  return buildGridTemplateFromFormation(formation);
}
