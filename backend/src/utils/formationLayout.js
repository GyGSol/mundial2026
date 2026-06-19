/** Posiciones en cancha (0–100) según formación táctica estilo diagrama Wikipedia. */

const DEFAULT_FORMATION = '4-3-3';
const LINE_POSITIONS = ['GK', 'DEF', 'MID', 'FWD'];

/**
 * Profundidad por línea (0 = arco propio, 100 = línea de medio campo).
 * DEF en borde del área, MID en centro del campo propio, FWD cerca de la línea media.
 */
const DEPTH_BY_ROWS = {
  4: [6, 30, 58, 85],
  5: [6, 26, 44, 64, 85],
  6: [6, 22, 36, 50, 68, 85],
};

/** Profundidad por rol cuando no hay fila de formación. */
const DEPTH_BY_POOL = {
  GK: 6,
  DEF: 30,
  MID: 58,
  FWD: 85,
};

/** Distribución lateral por cantidad de jugadores en la línea. */
const LATERAL_SLOTS = {
  1: [50],
  2: [30, 70],
  3: [18, 50, 82],
  4: [12, 35, 65, 88],
  5: [8, 26, 50, 74, 92],
};

/** @returns {number[]} filas desde portero hacia delante, ej. [1,4,3,3] */
export function parseFormationString(formation) {
  const raw = String(formation ?? DEFAULT_FORMATION).trim();
  const parts = raw
    .split('-')
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (!parts.length) return [1, 4, 3, 3];
  return [1, ...parts];
}

function depthForRow(rowIndex, totalRows) {
  const preset = DEPTH_BY_ROWS[totalRows];
  if (preset?.[rowIndex] != null) return preset[rowIndex];
  if (totalRows <= 1) return 50;
  return 6 + (rowIndex / (totalRows - 1)) * 79;
}

function depthFromApiRow(row, maxRow) {
  if (maxRow <= 1) return DEPTH_BY_POOL.GK;
  const t = (Math.min(row, maxRow) - 1) / (maxRow - 1);
  return 6 + t * 79;
}

function lateralForSlot(slotIndex, count) {
  const slots = LATERAL_SLOTS[count] ?? LATERAL_SLOTS[3];
  if (count <= 1) return slots[0];
  return slots[Math.min(slotIndex, slots.length - 1)];
}

function lateralFromApiGrid(grid, lineCount) {
  const col = Number(String(grid ?? '').split(':')[1]);
  if (!Number.isFinite(col) || col < 1) return null;
  return lateralForSlot(Math.min(col - 1, lineCount - 1), lineCount);
}

/** Orden lateral izq→der según texto de posición (estilo diagrama táctico). */
export function lateralSortKey(player) {
  const text = `${player.positionDetail ?? ''} ${player.position ?? ''}`.toLowerCase();
  if (text.includes('goalkeeper') || text === 'gk') return 50;
  if (text.includes('left') && !text.includes('centre') && !text.includes('center')) return 5;
  if (text.includes('right') && !text.includes('centre') && !text.includes('center')) return 95;
  if (text.includes('left wing') || (text.includes('winger') && text.includes('left'))) return 12;
  if (text.includes('right wing') || (text.includes('winger') && text.includes('right'))) return 88;
  if (text.includes('defensive mid')) return 42;
  if (text.includes('attacking mid')) return 58;
  if (text.includes('centre-forward') || text.includes('center forward') || text === 'st') return 50;
  if (text.includes('centre-back') || text.includes('center back')) return 50;
  return 50;
}

/** Profundidad relativa dentro del mediocampo (pivote vs interior). */
function midfieldDepthBias(player) {
  const text = `${player.positionDetail ?? ''}`.toLowerCase();
  if (text.includes('defensive') || text.includes('holding')) return -4;
  if (text.includes('attacking')) return 4;
  return 0;
}

function sortPlayersInLine(players, { pool, lineIndex, totalRows } = {}) {
  const sorted = [...players];
  if (pool === 'GK') return sorted;
  if (pool === 'MID' && lineIndex > 1 && lineIndex < totalRows - 1) {
    return sorted.sort(
      (a, b) =>
        midfieldDepthBias(a) - midfieldDepthBias(b) ||
        lateralSortKey(a) - lateralSortKey(b) ||
        (Number(a.shirtNumber) || 99) - (Number(b.shirtNumber) || 99)
    );
  }
  return sorted.sort(
    (a, b) =>
      lateralSortKey(a) - lateralSortKey(b) ||
      (Number(a.shirtNumber) || 99) - (Number(b.shirtNumber) || 99)
  );
}

function poolForLine(rowIndex, totalRows) {
  if (rowIndex === 0) return 'GK';
  if (rowIndex === totalRows - 1) return 'FWD';
  if (rowIndex === 1) return 'DEF';
  return 'MID';
}

function isForwardLike(player) {
  const mapped = mapFootballDataPositionText(player.positionDetail ?? player.position);
  return mapped === 'FWD';
}

/**
 * API-Football grid "fila:cola" — fila 1 = portería, columna izq→der del equipo.
 * @returns {{ gridX: number, gridY: number } | null}
 */
export function parseApiFootballGrid(grid, formation = DEFAULT_FORMATION) {
  const text = String(grid ?? '').trim();
  if (!text) return null;
  const [rowRaw, colRaw] = text.split(':');
  const row = Number(rowRaw);
  const col = Number(colRaw);
  if (!Number.isFinite(row) || !Number.isFinite(col) || row < 1 || col < 1) return null;

  const rows = parseFormationString(formation);
  const maxRow = rows.length;
  const lineCount = rows[Math.min(row, maxRow) - 1] ?? 1;

  const depth = depthFromApiRow(row, maxRow);
  const lateral = lateralForSlot(Math.min(col - 1, lineCount - 1), lineCount);

  return {
    gridX: Number(depth.toFixed(1)),
    gridY: Number(lateral.toFixed(1)),
  };
}

/**
 * Asigna slots normalizados por formación (sin jugadores).
 * gridX = profundidad hacia el rival; gridY = eje vertical de la cancha.
 */
export function assignFormationGrid(formation, playerCount = 11) {
  const rows = parseFormationString(formation);
  const slots = [];
  const rowCount = rows.length;

  rows.forEach((count, rowIndex) => {
    const depth = depthForRow(rowIndex, rowCount);
    for (let i = 0; i < count; i += 1) {
      slots.push({
        gridX: Number(depth.toFixed(1)),
        gridY: Number(lateralForSlot(i, count).toFixed(1)),
      });
    }
  });

  return slots.slice(0, playerCount);
}

/**
 * Agrupa jugadores por líneas tácticas y asigna coordenadas estilo Wikipedia.
 * La profundidad (gridX) siempre sale de la formación; el grid API solo ayuda en el eje lateral.
 */
export function assignPlayersToFormation(players, formation = DEFAULT_FORMATION) {
  const rows = parseFormationString(formation);
  const rowCount = rows.length;

  const pools = Object.fromEntries(LINE_POSITIONS.map((p) => [p, []]));
  for (const player of players) {
    const detail = player.positionDetail ?? player.position;
    const pool = mapFootballDataPositionText(detail);
    pools[pool].push({ ...player, position: pool });
  }

  const assigned = [];
  const lineSpecs = rows.map((count, rowIndex) => ({
    count,
    rowIndex,
    pool: poolForLine(rowIndex, rowCount),
  }));

  for (const spec of lineSpecs) {
    const available = pools[spec.pool];

    // Si faltan delanteros, tomar los más ofensivos del pool de medios
    if (spec.pool === 'FWD' && available.length < spec.count && pools.MID.length) {
      const forwardLike = pools.MID.filter(isForwardLike);
      const rest = pools.MID.filter((p) => !isForwardLike(p));
      pools.MID = rest;
      available.push(...forwardLike);
    }

    const picked = sortPlayersInLine(available.splice(0, spec.count), {
      pool: spec.pool,
      lineIndex: spec.rowIndex,
      totalRows: rowCount,
    });

    const depth = depthForRow(spec.rowIndex, rowCount);
    picked.forEach((player, slotIndex) => {
      const apiLateral = player.gridRaw
        ? lateralFromApiGrid(player.gridRaw, picked.length)
        : null;
      const midBias = spec.pool === 'MID' ? midfieldDepthBias(player) : 0;
      const { gridRaw: _gridRaw, gridX: _gridX, gridY: _gridY, ...rest } = player;
      assigned.push({
        ...rest,
        gridX: Number(Math.min(88, Math.max(4, depth + midBias)).toFixed(1)),
        gridY: Number((apiLateral ?? lateralForSlot(slotIndex, picked.length)).toFixed(1)),
      });
    });
  }

  for (const pool of LINE_POSITIONS) {
    for (const leftover of pools[pool]) {
      const fallbackDepth = DEPTH_BY_POOL[pool] ?? DEPTH_BY_POOL.MID;
      const { gridRaw: _gridRaw, gridX: _gridX, gridY: _gridY, ...rest } = leftover;
      assigned.push({
        ...rest,
        gridX: fallbackDepth,
        gridY: lateralSortKey(leftover),
      });
    }
  }

  return assigned;
}

/** @deprecated Usar assignPlayersToFormation */
export function mergePlayerGrids(players, formation) {
  return assignPlayersToFormation(players, formation);
}

export function mapFootballDataPositionText(text) {
  const p = String(text ?? '').trim().toLowerCase();
  if (!p) return 'MID';
  if (p.includes('goalkeeper') || p === 'gk' || p === 'g') return 'GK';
  if (p === 'df' || p === 'def') return 'DEF';
  if (p === 'mf' || p === 'mid') return 'MID';
  if (p === 'fw' || p === 'fwd') return 'FWD';

  // Delanteros / extremos (antes de "defen" y "mid")
  if ((p.includes('wing') || p.includes('winger')) && !p.includes('back')) return 'FWD';
  if (
    p.includes('forward') ||
    p.includes('striker') ||
    p.includes('offence') ||
    p.includes('offense') ||
    p === 'fwd' ||
    p === 'f' ||
    p === 'st' ||
    p === 'cf'
  ) {
    return 'FWD';
  }

  if (p.includes('mid') || p === 'mid' || p === 'm' || p.includes('midfield')) return 'MID';

  if (
    p.includes('back') ||
    p.includes('defen') ||
    p === 'def' ||
    p === 'd' ||
    p.includes('centre-back') ||
    p.includes('center back')
  ) {
    return 'DEF';
  }

  return 'MID';
}
