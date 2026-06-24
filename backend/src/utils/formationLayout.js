/** Posiciones en cancha (0–100) según formación táctica estilo diagrama Wikipedia. */

import { inferTacticalPosition } from './playerPositionLabel.js';
import { assignPlayersToPitchGrid, enforceUniquePitchCells } from './formationPitchGrid.js';

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
  2: [20, 80],
  3: [8, 50, 92],
  4: [4, 26, 74, 96],
  5: [2, 18, 50, 82, 98],
};

const PITCH_LATERAL_MIN = 2;
const PITCH_LATERAL_MAX = 98;
const PITCH_LATERAL_EXPAND = 1.14;

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
export function mdMeansCenterInMidLine(linePlayers = []) {
  const tokenOf = (p) =>
    String(p?.positionDetail ?? p?.position ?? '')
      .trim()
      .split(/\s+/)[0]
      ?.toUpperCase() ?? '';
  const mdCount = linePlayers.filter((p) => tokenOf(p) === 'MD').length;
  if (mdCount >= 2) return true;

  const textOf = (p) => `${p?.positionDetail ?? ''} ${p?.position ?? ''}`.toLowerCase();
  return linePlayers.some((p) => {
    if (tokenOf(p) !== 'MD') return false;
    return (
      textOf(p).includes('defensive') ||
      textOf(p).includes('holding') ||
      textOf(p).includes('defensa') ||
      textOf(p).includes('pivote')
    );
  });
}

/** Orden lateral izq→der según texto de posición (estilo diagrama táctico). */
export function lateralSortKey(player, linePlayers) {
  const raw = `${player.positionDetail ?? ''} ${player.position ?? ''}`.trim();
  const token = raw.split(/\s+/)[0]?.toUpperCase() ?? '';
  const text = raw.toLowerCase();

  if (token === 'POR' || token === 'GK' || text.includes('goalkeeper') || text === 'gk') return 50;
  if (token === 'LI') return 4;
  if (token === 'LD') return 96;
  if (token === 'MI') return 8;
  if (token === 'MD') {
    if (linePlayers && mdMeansCenterInMidLine(linePlayers)) return 42;
    return 92;
  }
  if (token === 'MCD') return 36;
  if (token === 'MCO') return 64;
  if (token === 'MC' || token === 'DFC' || token === 'DC') return 50;
  if (text.includes('left') && !text.includes('centre') && !text.includes('center')) return 2;
  if (text.includes('right') && !text.includes('centre') && !text.includes('center')) return 98;
  if (text.includes('left wing') || (text.includes('winger') && text.includes('left'))) return 8;
  if (text.includes('right wing') || (text.includes('winger') && text.includes('right'))) return 92;
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

function isNaturalForward(player) {
  return isForwardLike(player);
}

function positionToken(player) {
  const detail = String(player?.positionDetail ?? '').trim();
  if (detail) return detail.split(/\s+/)[0].toUpperCase();
  return String(player?.position ?? '')
    .trim()
    .split(/\s+/)[0]
    .toUpperCase();
}

/** Mayor score = más apto como segundo delantero desde el mediocampo (4-4-2, etc.). */
export function attackingMidPromotionScore(player) {
  const token = positionToken(player);
  const raw = `${player.positionDetail ?? ''} ${player.position ?? ''}`.trim();
  const text = raw.toLowerCase();

  if (isForwardLike(player)) return 120;
  if (token === 'MCO' || text.includes('attacking mid')) return 100;
  if (text.includes('attacking')) return 90;
  if (token === 'MC') return 75;
  if (token === 'MD') return 55;
  if (token === 'MI') return 45;
  if (token === 'MCD' || text.includes('defensive') || text.includes('holding')) return 10;
  return 35;
}

/** Completa el pool de delanteros con medios ofensivos cuando la formación pide más FWD que jugadores netos. */
function balanceForwardPoolFromMidfield(pools, rows) {
  const fwdNeeded = rows[rows.length - 1] ?? 0;
  let deficit = fwdNeeded - pools.FWD.length;
  if (deficit <= 0 || !pools.MID.length) return;

  const rowCount = rows.length;
  const midNeeded = rows.reduce(
    (sum, count, rowIndex) => (poolForLine(rowIndex, rowCount) === 'MID' ? sum + count : sum),
    0
  );
  const maxPromote = Math.max(0, pools.MID.length - midNeeded);

  const promoteFromMid = () => {
    if (!pools.MID.length) return null;
    const sorted = [...pools.MID].sort(
      (a, b) =>
        attackingMidPromotionScore(b) - attackingMidPromotionScore(a) ||
        (Number(a.shirtNumber) || 99) - (Number(b.shirtNumber) || 99)
    );
    const picked = sorted[0];
    pools.MID = pools.MID.filter((p) => p !== picked);
    pools.FWD.push(picked);
    return picked;
  };

  let promoted = 0;
  while (deficit > 0 && promoted < maxPromote) {
    if (!promoteFromMid()) break;
    deficit -= 1;
    promoted += 1;
  }
}

function depthForPromotedForward(rowIndex, rowCount) {
  if (rowIndex <= 0) return depthForRow(rowIndex, rowCount);
  const midDepth = depthForRow(rowIndex - 1, rowCount);
  const fwdDepth = depthForRow(rowIndex, rowCount);
  return Number((midDepth + (fwdDepth - midDepth) * 0.55).toFixed(1));
}

function gridDepthForLine(player, spec, rowCount) {
  const depth = depthForRow(spec.rowIndex, rowCount);
  if (spec.pool === 'FWD') {
    return isNaturalForward(player) ? depth : depthForPromotedForward(spec.rowIndex, rowCount);
  }
  if (spec.pool === 'MID') {
    return Number(Math.min(88, Math.max(4, depth + midfieldDepthBias(player))).toFixed(1));
  }
  return depth;
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

function forwardCenterClusterLateralSlots(count) {
  if (count <= 1) return [50];
  if (count === 2) return [28, 72];
  if (count === 3) return [22, 50, 78];
  return centerClusterLateralSlots(count);
}

function lateralPositionsForLine(players, count, pool) {
  if (count <= 0) return [];

  if (pool === 'FWD') {
    const centerLike = players.filter(isCenterForwardLike);
    if (centerLike.length >= 2) {
      const centerSorted = [...centerLike].sort(
        (a, b) => (Number(a.shirtNumber) || 99) - (Number(b.shirtNumber) || 99)
      );
      const centerSlots = forwardCenterClusterLateralSlots(centerSorted.length);
      const wings = players.filter((player) => !centerLike.includes(player));
      const slotsByPlayer = new Map();
      centerSorted.forEach((player, index) => {
        slotsByPlayer.set(player, centerSlots[index]);
      });
      if (wings.length === 1) {
        slotsByPlayer.set(wings[0], lateralSortKey(wings[0], players) <= 50 ? 8 : 92);
      } else if (wings.length > 1) {
        const wingSlots =
          wings.length === 2
            ? [8, 92]
            : Array.from({ length: wings.length }, (_, slotIndex) =>
                lateralForSlot(slotIndex, wings.length)
              );
        wings.forEach((player, index) => {
          slotsByPlayer.set(player, wingSlots[index]);
        });
      }
      return players.map((player) => Number((slotsByPlayer.get(player) ?? 50).toFixed(1)));
    }
    if (centerLike.length === count) return centerClusterLateralSlots(count);
  }

  const keys = players.map((player) => lateralSortKey(player, players));
  if (count >= 2 && new Set(keys).size < keys.length) {
    const anchor = keys.reduce((sum, key) => sum + key, 0) / keys.length;
    return anchoredLateralSlots(count, anchor, { minStep: count === 2 ? 22 : 16 });
  }

  if (pool === 'DEF' && count >= 3) {
    return Array.from({ length: count }, (_, slotIndex) => lateralForSlot(slotIndex, count));
  }

  if (pool === 'DEF') {
    const centerBacks = players.filter(isCenterBackLike);
    if (centerBacks.length >= 2 && centerBacks.length === count) {
      return centerClusterLateralSlots(count);
    }
  }

  return Array.from({ length: count }, (_, slotIndex) => lateralForSlot(slotIndex, count));
}

/**
 * Agrupa jugadores por líneas tácticas y asigna coordenadas estilo Wikipedia.
 * La profundidad (gridX) siempre sale de la formación; el grid API no fija el eje lateral.
 */
export function assignPlayersToFormation(players, formation = DEFAULT_FORMATION) {
  const resolved = String(formation ?? DEFAULT_FORMATION).trim() || DEFAULT_FORMATION;
  return assignPlayersToPitchGrid(players ?? [], resolved);
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
  const detail = player?.positionDetail ?? player?.position ?? '';
  const token = String(detail).trim().split(/\s+/)[0]?.toUpperCase() ?? '';
  if (token === 'DC' || token === 'CF' || token === 'ST') return true;

  const text = `${player?.positionDetail ?? ''} ${player?.position ?? ''}`.trim().toUpperCase();
  if (text.includes('CENTRE-FORWARD') || text.includes('CENTER FORWARD')) return true;
  if (mapFootballDataPositionText(player.positionDetail ?? player.position) !== 'FWD') return false;
  return lateralSortKey(player) >= 38 && lateralSortKey(player) <= 62;
}

export function isCenterBackLike(player) {
  const text = `${player?.positionDetail ?? ''} ${player?.position ?? ''}`.trim().toUpperCase();
  if (text === 'DFC' || text.includes('CENTRE-BACK') || text.includes('CENTER BACK')) return true;
  if (mapFootballDataPositionText(text) !== 'DEF') return false;
  return lateralSortKey(player) >= 38 && lateralSortKey(player) <= 62;
}

export function isCenterMidLike(player, linePlayers) {
  const text = `${player?.positionDetail ?? ''} ${player?.position ?? ''}`.trim().toUpperCase();
  const token = text.split(/\s+/)[0] ?? '';
  if (token === 'MI') return false;
  if (token === 'MD') return mdMeansCenterInMidLine(linePlayers ?? [player]);
  if (token === 'MC' || token === 'MCO' || token === 'MCD') return true;
  if (mapFootballDataPositionText(text) !== 'MID') return false;
  const lower = text.toLowerCase();
  if (lower.includes('left') || lower.includes('right') || lower.includes('wing')) return false;
  return lateralSortKey(player) >= 38 && lateralSortKey(player) <= 62;
}

function centerClusterLateralSlots(count) {
  if (count <= 1) return [50];
  if (count === 2) return [38, 62];
  if (count === 3) return [28, 50, 72];
  const step = Math.min(16, Math.max(10, 44 / (count - 1)));
  const start = 50 - (step * (count - 1)) / 2;
  return Array.from({ length: count }, (_, index) =>
    Number(Math.min(PITCH_LATERAL_MAX, Math.max(PITCH_LATERAL_MIN, start + step * index)).toFixed(1))
  );
}

function anchoredLateralSlots(count, anchorY, { minStep = 18 } = {}) {
  if (count <= 1) return [Number(anchorY.toFixed(1))];
  const step = Math.max(minStep, Math.min(32, 56 / Math.max(1, count - 1)));
  const start = anchorY - (step * (count - 1)) / 2;
  return Array.from({ length: count }, (_, index) =>
    Number(Math.min(PITCH_LATERAL_MAX, Math.max(PITCH_LATERAL_MIN, start + step * index)).toFixed(1))
  );
}

function slotsForSamePositionToken(count, token, anchorY) {
  if (token === 'DC' || token === 'CF' || token === 'ST') {
    return forwardCenterClusterLateralSlots(count);
  }
  return anchoredLateralSlots(count, anchorY, { minStep: count === 2 ? 26 : 18 });
}

const TACTICAL_POSITION_TOKENS = new Set([
  'POR',
  'GK',
  'LI',
  'LD',
  'DFC',
  'MI',
  'MD',
  'MCD',
  'MCO',
  'MC',
  'EI',
  'ED',
  'DC',
  'CF',
  'ST',
]);

function tacticalLateralSortKey(player) {
  const token = positionToken(player);
  if (TACTICAL_POSITION_TOKENS.has(token)) {
    return lateralSortKey({ position: token, positionDetail: token });
  }

  const inferred = inferTacticalPosition({
    position: player?.position,
    positionX: player?.gridX,
    positionY: player?.gridY,
  });
  if (inferred) {
    return lateralSortKey({ position: inferred, positionDetail: inferred });
  }
  return lateralSortKey(player);
}

function pitchCellKey(player, cellSize = 8) {
  const x = Number(player?.gridX ?? 50);
  const y = Number(player?.gridY ?? 50);
  return `${Math.round(x / cellSize)}:${Math.round(y / cellSize)}`;
}

function slotsForCoLocatedGroup(sortedEntries) {
  const count = sortedEntries.length;
  if (count <= 1) {
    return [Number(sortedEntries[0]?.player.gridY ?? 50)];
  }

  const keys = sortedEntries.map(({ player }) => tacticalLateralSortKey(player));
  const keySpread = Math.max(...keys) - Math.min(...keys);
  const uniqueKeys = new Set(keys);

  if (keySpread >= 14 && uniqueKeys.size === keys.length) {
    return keys.map((key) => Number(key.toFixed(1)));
  }

  const anchor = keys.reduce((sum, key) => sum + key, 0) / keys.length;
  if (count >= 3) {
    return Array.from({ length: count }, (_, slotIndex) => lateralForSlot(slotIndex, count));
  }
  return anchoredLateralSlots(count, anchor, { minStep: 30 });
}

export function spreadCoLocatedPlayers(players, { cellSize = 8 } = {}) {
  if (!players?.length) return players ?? [];

  const buckets = new Map();
  for (const entry of players.map((player, index) => ({ player, index }))) {
    const token = positionToken(entry.player);
    if (token === 'POR' || token === 'GK') continue;
    const key = pitchCellKey(entry.player, cellSize);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(entry);
  }

  let result = [...players];
  for (const group of buckets.values()) {
    if (group.length < 2) continue;

    const sorted = [...group].sort(
      (a, b) =>
        tacticalLateralSortKey(a.player) - tacticalLateralSortKey(b.player) ||
        (Number(a.player.shirtNumber) || 99) - (Number(b.player.shirtNumber) || 99)
    );
    const slots = slotsForCoLocatedGroup(sorted);
    sorted.forEach(({ index }, slot) => {
      result[index] = { ...result[index], gridY: slots[slot] };
    });
  }

  return result;
}

export function spreadSamePositionOverlaps(players, { depthBucket = 10, yTolerance = 14 } = {}) {
  if (!players?.length) return players ?? [];

  const buckets = new Map();
  for (const entry of players.map((player, index) => ({ player, index }))) {
    const token = positionToken(entry.player);
    if (!token || token === 'POR' || token === 'GK') continue;
    const depth = Number(entry.player.gridX ?? 50);
    const key = `${token}:${Math.round(depth / depthBucket)}`;
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
    const anchorY = ys.reduce((sum, y) => sum + y, 0) / ys.length;
    const token = positionToken(sorted[0].player);
    const slots = slotsForSamePositionToken(sorted.length, token, anchorY);
    sorted.forEach(({ index }, slot) => {
      result[index] = { ...result[index], gridY: slots[slot] };
    });
  }

  return result;
}

function spreadPoolCenterClusters(
  players,
  {
    pool,
    minDepth,
    maxDepth,
    isCenterLike,
    yTolerance = 10,
    depthBucket = 8,
    slotFn = centerClusterLateralSlots,
  } = {}
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
    const slots = slotFn(sorted.length);
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
    yTolerance: 14,
    depthBucket: 20,
    slotFn: forwardCenterClusterLateralSlots,
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

export function expandPitchLateralSpread(players, { factor = PITCH_LATERAL_EXPAND } = {}) {
  if (!players?.length) return players ?? [];

  const expanded = players.map((player) => {
    const token = positionToken(player);
    if (token === 'POR' || token === 'GK') return player;

    const y = Number(player.gridY ?? 50);
    if (!Number.isFinite(y)) return player;

    const nextY = 50 + (y - 50) * factor;
    return {
      ...player,
      gridY: Number(
        Math.min(PITCH_LATERAL_MAX, Math.max(PITCH_LATERAL_MIN, nextY)).toFixed(1)
      ),
    };
  });

  return resolveExactGridCollisions(expanded);
}

function resolveExactGridCollisions(players) {
  if (!players?.length) return players ?? [];

  const buckets = new Map();
  for (const entry of players.map((player, index) => ({ player, index }))) {
    const token = positionToken(entry.player);
    if (token === 'POR' || token === 'GK') continue;

    const x = Number(entry.player.gridX ?? 50).toFixed(1);
    const y = Number(entry.player.gridY ?? 50).toFixed(1);
    const key = `${x}:${y}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(entry);
  }

  let result = [...players];
  for (const group of buckets.values()) {
    if (group.length < 2) continue;

    const sorted = [...group].sort(
      (a, b) =>
        tacticalLateralSortKey(a.player) - tacticalLateralSortKey(b.player) ||
        (Number(a.player.shirtNumber) || 99) - (Number(b.player.shirtNumber) || 99)
    );
    const anchorY = Number(sorted[0].player.gridY ?? 50);
    const slots = anchoredLateralSlots(sorted.length, anchorY, { minStep: 14 });
    sorted.forEach(({ index }, slot) => {
      result[index] = { ...result[index], gridY: slots[slot] };
    });
  }

  return result;
}

export function spreadTacticalLineClusters(players) {
  let next = spreadDefCenterClusters(players);
  next = spreadMidCenterClusters(next);
  next = spreadForwardCenterClusters(next);
  next = spreadSamePositionOverlaps(next);
  next = spreadCoLocatedPlayers(next);
  return expandPitchLateralSpread(next);
}

/** Separa jugadores que comparten gridX/gridY para que no se oculten en la cancha. */
export function spreadOverlappingGridPositions(players, { lateralStep = 12 } = {}) {
  if (!players?.length) return players ?? [];

  const entries = players.map((player, index) => ({
    player,
    index,
    gridKey: pitchCellKey(player),
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
    const baseX = Number(group[0].player.gridX ?? 50);
    const slots = slotsForCoLocatedGroup(group);

    group.forEach((entry, slot) => {
      adjusted[entry.index] = {
        ...entry.player,
        gridX: baseX,
        gridY: slots[slot],
      };
    });
  }

  return enforceUniquePitchCells(spreadTacticalLineClusters(adjusted.filter(Boolean)));
}
