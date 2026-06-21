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

/** @returns {string|null} ej. "3-1-4-2" desde gridRaw "fila:col" de API-Football */
export function inferFormationFromGridRows(players) {
  const rowCounts = new Map();
  let withGrid = 0;

  for (const player of players ?? []) {
    const text = String(player?.gridRaw ?? '').trim();
    if (!text) continue;
    const row = Number(text.split(':')[0]);
    if (!Number.isFinite(row) || row < 1) continue;
    withGrid += 1;
    rowCounts.set(row, (rowCounts.get(row) ?? 0) + 1);
  }

  if (withGrid < 7) return null;

  const rows = [...rowCounts.keys()].sort((a, b) => a - b);
  const counts = rows.map((row) => rowCounts.get(row));
  if (counts[0] !== 1) return null;

  const outfield = counts.slice(1);
  if (outfield.reduce((sum, count) => sum + count, 0) !== 10) return null;

  return outfield.join('-');
}

/** Inferencia gruesa DEF-MID-FWD cuando no hay grid (p. ej. 5-4-1). */
export function inferFormationFromPositionPools(players) {
  const pools = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  for (const player of players ?? []) {
    const pool = mapFootballDataPositionText(player?.positionDetail ?? player?.position);
    if (pools[pool] != null) pools[pool] += 1;
  }

  if (pools.GK !== 1) return null;
  const outfieldTotal = pools.DEF + pools.MID + pools.FWD;
  if (outfieldTotal !== 10) return null;

  const parts = [];
  if (pools.DEF > 0) parts.push(pools.DEF);
  if (pools.MID > 0) parts.push(pools.MID);
  if (pools.FWD > 0) parts.push(pools.FWD);
  return parts.length ? parts.join('-') : null;
}

const MIN_GRID_FORMATION_OVERRIDE = 9;

/** Resuelve formación explícita, grid API o conteo por posición — evita 4-3-3 por defecto ciego. */
export function resolveFormation(players, explicitFormation) {
  const explicit = String(explicitFormation ?? '').trim();
  const fromGrid = inferFormationFromGridRows(players);
  const gridCount = (players ?? []).filter((p) => String(p?.gridRaw ?? '').trim()).length;

  if (fromGrid) {
    if (!explicit || explicit === DEFAULT_FORMATION) return fromGrid;
    if (fromGrid !== explicit && gridCount >= MIN_GRID_FORMATION_OVERRIDE) return fromGrid;
    return explicit;
  }

  if (explicit) return explicit;

  return inferFormationFromPositionPools(players) ?? DEFAULT_FORMATION;
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
  const raw = `${player.positionDetail ?? ''} ${player.position ?? ''}`.trim();
  const token = raw.split(/\s+/)[0]?.toUpperCase() ?? '';
  const text = raw.toLowerCase();

  if (token === 'POR' || token === 'GK' || text.includes('goalkeeper') || text === 'gk') return 50;
  if (token === 'LI') return 8;
  if (token === 'LD') return 92;
  if (token === 'MI') return 18;
  if (token === 'MD') return 82;
  if (token === 'MCD') return 42;
  if (token === 'MCO') return 58;
  if (token === 'MC' || token === 'DFC' || token === 'DC') return 50;
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
  const raw = `${player.positionDetail ?? ''} ${player.position ?? ''}`.trim().toUpperCase();
  const token = raw.split(/\s+/)[0] ?? '';
  if (token === 'MCD' || raw.includes('DEFENSIVE') || raw.includes('HOLDING')) return -6;
  if (token === 'MCO' || raw.includes('ATTACKING')) return 6;
  const text = raw.toLowerCase();
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

/**
 * Coloca jugadores usando grid API cuando hay datos suficientes; si no, cae en assignPlayersToFormation.
 */
export function assignPlayersWithFormationLayout(players, formation = DEFAULT_FORMATION) {
  const resolvedFormation = resolveFormation(players, formation);
  const gridCount = (players ?? []).filter((p) => String(p?.gridRaw ?? '').trim()).length;

  if (gridCount >= 7) {
    const assigned = players.map((player) => {
      const coords = player.gridRaw
        ? parseApiFootballGrid(player.gridRaw, resolvedFormation)
        : null;
      const { gridRaw, gridX, gridY, ...rest } = player;
      if (coords) {
        return {
          ...rest,
          gridX: coords.gridX,
          gridY: coords.gridY,
        };
      }
      return rest;
    });

    const missing = assigned.filter((p) => p.gridX == null);
    if (!missing.length) return assigned;

    const placed = assignPlayersToFormation(missing, resolvedFormation);
    const withCoords = assigned.filter((p) => p.gridX != null);
    return [...withCoords, ...placed];
  }

  return assignPlayersToFormation(players, resolvedFormation);
}

/** @deprecated Usar assignPlayersWithFormationLayout */
export function mergePlayerGrids(players, formation) {
  return assignPlayersWithFormationLayout(players, formation);
}

export function mapFootballDataPositionText(text) {
  const p = String(text ?? '').trim().toUpperCase();
  if (!p) return 'MID';
  if (p.includes('GOALKEEPER') || p === 'GK' || p === 'G' || p === 'POR') return 'GK';
  if (p === 'DF' || p === 'DEF') return 'DEF';
  if (p === 'MF' || p === 'MID' || p === 'MD' || p === 'MCD' || p === 'MCO' || p === 'MI' || p === 'MC') {
    return 'MID';
  }
  if (p === 'FW' || p === 'FWD' || p === 'DC' || p === 'EI' || p === 'ED' || p === 'ST' || p === 'CF') {
    return 'FWD';
  }

  const lower = p.toLowerCase();
  if ((lower.includes('wing') || lower.includes('winger')) && !lower.includes('back')) return 'FWD';
  if (
    lower.includes('forward') ||
    lower.includes('striker') ||
    lower.includes('offence') ||
    lower.includes('offense') ||
    lower === 'fwd' ||
    lower === 'f' ||
    lower === 'st' ||
    lower === 'cf'
  ) {
    return 'FWD';
  }
  if (lower.includes('mid') || lower === 'm' || lower.includes('midfield')) return 'MID';
  if (
    lower.includes('back') ||
    lower.includes('defen') ||
    lower === 'def' ||
    lower === 'd' ||
    lower.includes('centre-back') ||
    lower.includes('center back') ||
    lower === 'dfc' ||
    lower === 'li' ||
    lower === 'ld'
  ) {
    return 'DEF';
  }

  return 'MID';
}

export function isCenterForwardLike(player) {
  const text = `${player?.positionDetail ?? ''} ${player?.position ?? ''}`.trim().toUpperCase();
  if (
    text === 'DC' ||
    text === 'CF' ||
    text === 'ST' ||
    text.includes('CENTRE-FORWARD') ||
    text.includes('CENTER FORWARD')
  ) {
    return true;
  }
  if (mapFootballDataPositionText(text) !== 'FWD') return false;
  return lateralSortKey(player) >= 38 && lateralSortKey(player) <= 62;
}

export function isCenterBackLike(player) {
  const text = `${player?.positionDetail ?? ''} ${player?.position ?? ''}`.trim().toUpperCase();
  if (text === 'DFC' || text.includes('CENTRE-BACK') || text.includes('CENTER BACK')) return true;
  if (mapFootballDataPositionText(text) !== 'DEF') return false;
  return lateralSortKey(player) >= 38 && lateralSortKey(player) <= 62;
}

export function isCenterMidLike(player) {
  const text = `${player?.positionDetail ?? ''} ${player?.position ?? ''}`.trim().toUpperCase();
  const token = text.split(/\s+/)[0] ?? '';
  if (token === 'MI' || token === 'MD') return false;
  if (token === 'MC' || token === 'MCO' || token === 'MCD') return true;
  if (mapFootballDataPositionText(text) !== 'MID') return false;
  const lower = text.toLowerCase();
  if (lower.includes('left') || lower.includes('right') || lower.includes('wing')) return false;
  return lateralSortKey(player) >= 38 && lateralSortKey(player) <= 62;
}

function centerClusterLateralSlots(count) {
  if (count <= 1) return [50];
  if (count === 2) return [46, 54];
  if (count === 3) return [40, 50, 60];
  const step = Math.min(14, Math.max(8, 36 / (count - 1)));
  const start = 50 - (step * (count - 1)) / 2;
  return Array.from({ length: count }, (_, index) =>
    Number(Math.min(92, Math.max(8, start + step * index)).toFixed(1))
  );
}

function spreadPoolCenterClusters(
  players,
  { pool, minDepth, maxDepth, isCenterLike, yTolerance = 10, depthBucket = 8 } = {}
) {
  if (!players?.length) return players ?? [];

  const buckets = new Map();
  for (const entry of players.map((player, index) => ({ player, index }))) {
    const { player } = entry;
    if (mapFootballDataPositionText(player.positionDetail ?? player.position) !== pool) continue;
    if (!isCenterLike(player)) continue;
    const depth = Number(player.gridX ?? 0);
    if (depth < minDepth || depth > maxDepth) continue;
    const key = Math.round(depth / depthBucket);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(entry);
  }

  let result = [...players];
  for (const group of buckets.values()) {
    if (group.length < 2) continue;
    const ys = group.map(({ player }) => Number(player.gridY ?? 50));
    if (Math.max(...ys) - Math.min(...ys) > yTolerance) continue;

    const sorted = [...group].sort(
      (a, b) => (Number(a.player.shirtNumber) || 99) - (Number(b.player.shirtNumber) || 99)
    );
    const slots = centerClusterLateralSlots(sorted.length);
    sorted.forEach(({ index }, slot) => {
      result[index] = { ...result[index], gridY: slots[slot] };
    });
  }

  return result;
}

export function spreadForwardCenterClusters(players) {
  return spreadPoolCenterClusters(players, {
    pool: 'FWD',
    minDepth: 68,
    maxDepth: 100,
    isCenterLike: isCenterForwardLike,
  });
}

export function spreadMidCenterClusters(players) {
  return spreadPoolCenterClusters(players, {
    pool: 'MID',
    minDepth: 38,
    maxDepth: 72,
    isCenterLike: isCenterMidLike,
  });
}

export function spreadDefCenterClusters(players) {
  return spreadPoolCenterClusters(players, {
    pool: 'DEF',
    minDepth: 18,
    maxDepth: 42,
    isCenterLike: isCenterBackLike,
  });
}

export function spreadTacticalLineClusters(players) {
  let next = spreadDefCenterClusters(players);
  next = spreadMidCenterClusters(next);
  next = spreadForwardCenterClusters(next);
  return next;
}

/** Separa jugadores que comparten gridX/gridY para que no se oculten en la cancha. */
export function spreadOverlappingGridPositions(players, { lateralStep = 12 } = {}) {
  if (!players?.length) return players ?? [];

  const entries = players.map((player, index) => ({
    player,
    index,
    gridKey: `${Number(player.gridX ?? 50).toFixed(1)}:${Number(player.gridY ?? 50).toFixed(1)}`,
  }));

  const byGrid = new Map();
  for (const entry of entries) {
    if (!byGrid.has(entry.gridKey)) byGrid.set(entry.gridKey, []);
    byGrid.get(entry.gridKey).push(entry);
  }

  const adjusted = new Array(players.length);
  for (const group of byGrid.values()) {
    if (group.length === 1) {
      adjusted[group[0].index] = group[0].player;
      continue;
    }

    group.sort(
      (a, b) => (Number(a.player.shirtNumber) || 99) - (Number(b.player.shirtNumber) || 99)
    );
    const baseY = Number(group[0].player.gridY ?? 50);
    const baseX = Number(group[0].player.gridX ?? 50);
    const step = Math.max(lateralStep, 12 / Math.max(1, group.length - 1));

    group.forEach((entry, slot) => {
      const offset = (slot - (group.length - 1) / 2) * step;
      adjusted[entry.index] = {
        ...entry.player,
        gridX: baseX,
        gridY: Number(Math.min(98, Math.max(2, baseY + offset)).toFixed(1)),
      };
    });
  }

  return spreadTacticalLineClusters(adjusted.filter(Boolean));
}
