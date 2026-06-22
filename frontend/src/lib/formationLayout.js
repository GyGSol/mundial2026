/** Posiciones en cancha (0–100) según formación táctica — espejo de backend/src/utils/formationLayout.js */

import { inferTacticalPosition } from './playerPositionLabel.js';

const DEFAULT_FORMATION = '4-3-3';
const LINE_POSITIONS = ['GK', 'DEF', 'MID', 'FWD'];

const DEPTH_BY_ROWS = {
  4: [6, 30, 58, 85],
  5: [6, 26, 44, 64, 85],
  6: [6, 22, 36, 50, 68, 85],
};

const DEPTH_BY_POOL = {
  GK: 6,
  DEF: 30,
  MID: 58,
  FWD: 85,
};

const LATERAL_SLOTS = {
  1: [50],
  2: [30, 70],
  3: [18, 50, 82],
  4: [12, 35, 65, 88],
  5: [8, 26, 50, 74, 92],
};

export function parseFormationString(formation) {
  const raw = String(formation ?? DEFAULT_FORMATION).trim();
  const parts = raw
    .split('-')
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (!parts.length) return [1, 4, 3, 3];
  return [1, ...parts];
}

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

function lateralForSlot(slotIndex, count) {
  const slots = LATERAL_SLOTS[count] ?? LATERAL_SLOTS[3];
  if (count <= 1) return slots[0];
  return slots[Math.min(slotIndex, slots.length - 1)];
}

function positionToken(player) {
  const detail = String(player?.positionDetail ?? '').trim();
  if (detail) return detail.split(/\s+/)[0].toUpperCase();
  return String(player?.position ?? '')
    .trim()
    .split(/\s+/)[0]
    .toUpperCase();
}

export function lateralSortKey(player) {
  const token = positionToken(player);
  const raw = `${player.positionDetail ?? ''} ${player.position ?? ''}`.trim();
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
  return mapFootballDataPositionText(player.positionDetail ?? player.position) === 'FWD';
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

/** Delantero centro (DC/CF/ST) o perfil lateral centrado. */
export function isCenterForwardLike(player) {
  const token = positionToken(player);
  if (token === 'DC' || token === 'CF' || token === 'ST') return true;

  const text = `${player?.positionDetail ?? ''} ${player?.position ?? ''}`.trim().toUpperCase();
  if (text.includes('CENTRE-FORWARD') || text.includes('CENTER FORWARD')) return true;
  if (mapFootballDataPositionText(player.positionDetail ?? player.position) !== 'FWD') return false;
  const lateral = lateralSortKey(player);
  return lateral >= 38 && lateral <= 62;
}

/** Varios jugadores en el eje central: cerca del centro pero sin superponer avatares. */
export function centerClusterLateralSlots(count) {
  if (count <= 1) return [50];
  if (count === 2) return [46, 54];
  if (count === 3) return [40, 50, 60];
  const step = Math.min(14, Math.max(8, 36 / (count - 1)));
  const start = 50 - (step * (count - 1)) / 2;
  return Array.from({ length: count }, (_, index) =>
    Number(Math.min(92, Math.max(8, start + step * index)).toFixed(1))
  );
}

/** Delanteros centros: más apertura lateral que el resto de líneas. */
function forwardCenterClusterLateralSlots(count) {
  if (count <= 1) return [50];
  if (count === 2) return [40, 60];
  if (count === 3) return [38, 50, 62];
  return centerClusterLateralSlots(count);
}

/** Abre jugadores en línea (gridY) alrededor de un ancla lateral. */
function anchoredLateralSlots(count, anchorY, { minStep = 14 } = {}) {
  if (count <= 1) return [Number(anchorY.toFixed(1))];
  const step = Math.max(minStep, Math.min(22, 40 / Math.max(1, count - 1)));
  const start = anchorY - (step * (count - 1)) / 2;
  return Array.from({ length: count }, (_, index) =>
    Number(Math.min(92, Math.max(8, start + step * index)).toFixed(1))
  );
}

function slotsForSamePositionToken(count, token, anchorY) {
  if (token === 'DC' || token === 'CF' || token === 'ST') {
    return forwardCenterClusterLateralSlots(count);
  }
  return anchoredLateralSlots(count, anchorY, { minStep: count === 2 ? 18 : 14 });
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

/** Misma lógica que la etiqueta en cancha (MD, MCO, MI…) a partir de rol + coords. */
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
  return anchoredLateralSlots(count, anchor, { minStep: 20 });
}

/** Separa jugadores en la misma celda de cancha aunque el rol guardado difiera (MD vs MCO). */
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

/** @deprecated alias */
function centerForwardLateralSlots(count) {
  return centerClusterLateralSlots(count);
}

/** Central defensivo (DFC / centre-back). */
export function isCenterBackLike(player) {
  const token = positionToken(player);
  if (token === 'DFC') return true;
  if (token === 'LI' || token === 'LD' || token === 'DEF' || token === 'DF') return false;

  const text = `${player?.positionDetail ?? ''} ${player?.position ?? ''}`.trim().toUpperCase();
  if (text.includes('CENTRE-BACK') || text.includes('CENTER BACK')) return true;
  if (mapFootballDataPositionText(text) !== 'DEF') return false;
  return lateralSortKey(player) >= 38 && lateralSortKey(player) <= 62;
}

/** Mediocampista central (MC / MCO / pivote), no bandas MI/MD. */
export function isCenterMidLike(player) {
  const token = positionToken(player);
  if (token === 'MI' || token === 'MD') return false;
  if (token === 'MC' || token === 'MCO' || token === 'MCD') return true;
  if (token === 'MID' || token === 'MF' || !token) return false;

  const text = `${player?.positionDetail ?? ''} ${player?.position ?? ''}`.trim().toUpperCase();
  if (mapFootballDataPositionText(text) !== 'MID') return false;
  const lower = text.toLowerCase();
  if (lower.includes('left') || lower.includes('right') || lower.includes('wing')) return false;
  return lateralSortKey(player) >= 38 && lateralSortKey(player) <= 62;
}

function lateralPositionsForLine(players, count, pool) {
  if (count <= 0) return [];

  const keys = players.map((player) => lateralSortKey(player));
  if (count >= 2 && new Set(keys).size < keys.length) {
    const anchor = keys.reduce((sum, key) => sum + key, 0) / keys.length;
    return anchoredLateralSlots(count, anchor, { minStep: count === 2 ? 18 : 14 });
  }

  if (pool === 'MID' || pool === 'DEF') {
    const keySpread = Math.max(...keys) - Math.min(...keys);
    const uniqueKeys = new Set(keys);
    if (keySpread >= 16 && uniqueKeys.size === keys.length) {
      return keys.map((key) => Number(key.toFixed(1)));
    }
    if (pool === 'DEF' && count >= 3) {
      return Array.from({ length: count }, (_, slotIndex) => lateralForSlot(slotIndex, count));
    }
  }

  if (pool === 'FWD') {
    const centerLike = players.filter(isCenterForwardLike);
    if (centerLike.length === count) return centerClusterLateralSlots(count);
  }

  if (pool === 'DEF') {
    const centerBacks = players.filter(isCenterBackLike);
    if (centerBacks.length >= 2 && centerBacks.length === count) {
      return centerClusterLateralSlots(count);
    }
  }

  if (pool === 'MID') {
    const centerMids = players.filter(isCenterMidLike);
    if (centerMids.length >= 2 && centerMids.length === count) {
      return centerClusterLateralSlots(count);
    }
  }

  return Array.from({ length: count }, (_, slotIndex) => lateralForSlot(slotIndex, count));
}

/** Inferir línea táctica desde profundidad FIFA (0–100). */
export function poolFromPitchDepth(x) {
  const depth = Number(x);
  if (!Number.isFinite(depth)) return null;
  if (depth < 28) return 'DEF';
  if (depth > 72) return 'FWD';
  return 'MID';
}

export function resolvePlayerPool(player) {
  const mapped = mapFootballDataPositionText(player?.positionDetail ?? player?.position);
  if (mapped !== 'MID') return mapped;

  const fromCoords =
    poolFromPitchDepth(player?.positionX) ?? poolFromPitchDepth(player?.gridX);
  return fromCoords ?? 'MID';
}

export function assignPlayersToFormation(
  players,
  formation = DEFAULT_FORMATION,
  { includeLeftovers = true } = {}
) {
  const rows = parseFormationString(formation);
  const rowCount = rows.length;

  const pools = Object.fromEntries(LINE_POSITIONS.map((p) => [p, []]));
  for (const player of players) {
    const detail = player.positionDetail ?? player.position;
    const pool = mapFootballDataPositionText(detail);
    pools[pool].push({
      ...player,
      position: pool,
      positionDetail: player.positionDetail ?? player.position,
    });
  }

  const assigned = [];
  const lineSpecs = rows.map((count, rowIndex) => ({
    count,
    rowIndex,
    pool: poolForLine(rowIndex, rowCount),
  }));

  for (const spec of lineSpecs) {
    const available = pools[spec.pool];

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
    const lateralSlots = lateralPositionsForLine(picked, picked.length, spec.pool);
    picked.forEach((player, slotIndex) => {
      const midBias = spec.pool === 'MID' ? midfieldDepthBias(player) : 0;
      const { gridRaw: _gridRaw, gridX: _gridX, gridY: _gridY, ...rest } = player;
      assigned.push({
        ...rest,
        gridX: Number(Math.min(88, Math.max(4, depth + midBias)).toFixed(1)),
        gridY: Number((lateralSlots[slotIndex] ?? lateralForSlot(slotIndex, picked.length)).toFixed(1)),
      });
    });
  }

  if (includeLeftovers) {
    for (const pool of LINE_POSITIONS) {
      const leftovers = pools[pool];
      if (!leftovers.length) continue;

      const fallbackDepth = DEPTH_BY_POOL[pool] ?? DEPTH_BY_POOL.MID;
      const lateralSlots = lateralPositionsForLine(leftovers, leftovers.length, pool);
      leftovers.forEach((leftover, slotIndex) => {
        const { gridRaw: _gridRaw, gridX: _gridX, gridY: _gridY, ...rest } = leftover;
        assigned.push({
          ...rest,
          gridX: fallbackDepth,
          gridY: Number(
            (lateralSlots[slotIndex] ??
              lateralSortKey(leftover) ??
              lateralForSlot(slotIndex, leftovers.length)).toFixed(1)
          ),
        });
      });
    }
  }

  return assigned;
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

  return spreadTacticalLineClusters(adjusted.filter(Boolean));
}

/** Dos+ jugadores con la misma posición táctica y profundidad → línea horizontal (gridY). */
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

/** Dos+ DC en línea de ataque con casi la misma Y → abrir en el centro (40/60). */
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

/** Dos+ mediocampistas en la misma línea con roles laterales distintos (MD/MCO/MI). */
export function spreadMidfieldLineOverlaps(players) {
  return spreadLineByTacticalRole(players, {
    pool: 'MID',
    minDepth: 38,
    maxDepth: 72,
    depthBucket: 12,
  });
}

/** Cuatro defensores u otros roles en la misma profundidad FIFA. */
export function spreadDefenseLineOverlaps(players) {
  return spreadLineByTacticalRole(players, {
    pool: 'DEF',
    minDepth: 18,
    maxDepth: 42,
  });
}

function spreadLineByTacticalRole(
  players,
  { pool, minDepth, maxDepth, yTolerance = 12, depthBucket = 6, minKeySpread = 16 } = {}
) {
  if (!players?.length) return players ?? [];

  const buckets = new Map();
  for (const entry of players.map((player, index) => ({ player, index }))) {
    const { player } = entry;
    if (mapFootballDataPositionText(player.positionDetail ?? player.position) !== pool) continue;
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
      (a, b) =>
        tacticalLateralSortKey(a.player) - tacticalLateralSortKey(b.player) ||
        (Number(a.player.shirtNumber) || 99) - (Number(b.player.shirtNumber) || 99)
    );
    const keys = sorted.map(({ player }) => tacticalLateralSortKey(player));
    const keySpread = Math.max(...keys) - Math.min(...keys);

    if (keySpread >= minKeySpread) {
      sorted.forEach(({ player, index }) => {
        result[index] = {
          ...result[index],
          gridY: Number(tacticalLateralSortKey(player).toFixed(1)),
        };
      });
      continue;
    }

    const slots =
      pool === 'DEF' && sorted.length >= 3
        ? Array.from({ length: sorted.length }, (_, slotIndex) =>
            lateralForSlot(slotIndex, sorted.length)
          )
        : centerClusterLateralSlots(sorted.length);
    sorted.forEach(({ index }, slot) => {
      result[index] = { ...result[index], gridY: slots[slot] };
    });
  }

  return result;
}

/** Dos+ mediocampistas centrales amontonados en la misma línea. */
export function spreadMidCenterClusters(players) {
  return spreadPoolCenterClusters(players, {
    pool: 'MID',
    minDepth: 38,
    maxDepth: 72,
    isCenterLike: isCenterMidLike,
  });
}

/** Dos+ centrales (DFC) amontonados en la línea defensiva. */
export function spreadDefCenterClusters(players) {
  return spreadPoolCenterClusters(players, {
    pool: 'DEF',
    minDepth: 18,
    maxDepth: 42,
    isCenterLike: isCenterBackLike,
  });
}

/** Separa solapes tácticos en defensa, mediocampo y ataque. */
export function spreadTacticalLineClusters(players) {
  let next = spreadDefenseLineOverlaps(players);
  next = spreadDefCenterClusters(next);
  next = spreadMidfieldLineOverlaps(next);
  next = spreadMidCenterClusters(next);
  next = spreadForwardCenterClusters(next);
  next = spreadSamePositionOverlaps(next);
  next = spreadCoLocatedPlayers(next);
  return next;
}
