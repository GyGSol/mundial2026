/** Posiciones en cancha (0–100) según formación táctica estilo diagrama Wikipedia. */

const DEFAULT_FORMATION = '4-3-3';
const LINE_POSITIONS = ['GK', 'DEF', 'MID', 'FWD'];

/** Profundidad por línea (portería → centro del campo). */
const DEPTH_BY_ROWS = {
  4: [12, 30, 55, 80],
  5: [10, 26, 42, 62, 82],
  6: [10, 22, 36, 50, 66, 82],
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
  return 10 + (rowIndex / (totalRows - 1)) * 72;
}

function lateralForSlot(slotIndex, count) {
  const slots = LATERAL_SLOTS[count] ?? LATERAL_SLOTS[3];
  if (count <= 1) return slots[0];
  return slots[Math.min(slotIndex, slots.length - 1)];
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
  if (text.includes('defensive') || text.includes('holding')) return -6;
  if (text.includes('attacking')) return 6;
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
  const maxCol = Math.max(...rows, 1);

  const depth = depthForRow(Math.min(row - 1, maxRow - 1), maxRow);
  const lateral = lateralForSlot(Math.min(col - 1, maxCol - 1), maxCol);

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
 * Prioriza grid API-Football cuando existe.
 */
export function assignPlayersToFormation(players, formation = DEFAULT_FORMATION) {
  const rows = parseFormationString(formation);
  const rowCount = rows.length;

  const pools = Object.fromEntries(LINE_POSITIONS.map((p) => [p, []]));
  for (const player of players) {
    const pool = LINE_POSITIONS.includes(player.position) ? player.position : 'MID';
    pools[pool].push(player);
  }

  const assigned = [];
  const lineSpecs = rows.map((count, rowIndex) => ({
    count,
    rowIndex,
    pool: poolForLine(rowIndex, rowCount),
  }));

  for (const spec of lineSpecs) {
    const available = pools[spec.pool];
    const picked = sortPlayersInLine(available.splice(0, spec.count), {
      pool: spec.pool,
      lineIndex: spec.rowIndex,
      totalRows: rowCount,
    });

    const depth = depthForRow(spec.rowIndex, rowCount);
    picked.forEach((player, slotIndex) => {
      const fromApi = player.gridRaw
        ? parseApiFootballGrid(player.gridRaw, formation)
        : null;
      const midBias =
        spec.pool === 'MID' ? midfieldDepthBias(player) : 0;
      const coords = fromApi ?? {
        gridX: Number(Math.min(92, Math.max(8, depth + midBias)).toFixed(1)),
        gridY: Number(lateralForSlot(slotIndex, picked.length).toFixed(1)),
      };
      const { gridRaw: _gridRaw, ...rest } = player;
      assigned.push({ ...rest, gridX: coords.gridX, gridY: coords.gridY });
    });
  }

  // Jugadores sin slot (datos incompletos): rellenar con heurística por posición
  for (const pool of LINE_POSITIONS) {
    for (const leftover of pools[pool]) {
      const fromApi = leftover.gridRaw
        ? parseApiFootballGrid(leftover.gridRaw, formation)
        : null;
      const fallbackDepth =
        pool === 'GK' ? 12 : pool === 'DEF' ? 30 : pool === 'FWD' ? 80 : 55;
      const { gridRaw: _gridRaw, ...rest } = leftover;
      assigned.push({
        ...rest,
        gridX: fromApi?.gridX ?? fallbackDepth,
        gridY: fromApi?.gridY ?? lateralSortKey(leftover),
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
  const p = String(text ?? '').toLowerCase();
  if (p.includes('goalkeeper') || p === 'gk') return 'GK';
  if (
    p.includes('back') ||
    p.includes('defen') ||
    p === 'def' ||
    p.includes('centre-back')
  ) {
    return 'DEF';
  }
  if (p.includes('mid') || p === 'mid') return 'MID';
  if (
    p.includes('forward') ||
    p.includes('winger') ||
    p.includes('striker') ||
    p === 'fwd'
  ) {
    return 'FWD';
  }
  return 'MID';
}
