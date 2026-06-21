/** Posiciones en cancha (0–100) según formación táctica — espejo de backend/src/utils/formationLayout.js */

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
  const lateral = lateralSortKey(player);
  return lateral >= 38 && lateral <= 62;
}

/** Dos DC juntos: cerca del centro pero sin superponer avatares. */
function centerForwardLateralSlots(count) {
  if (count <= 1) return [50];
  if (count === 2) return [46, 54];
  if (count === 3) return [40, 50, 60];
  const step = Math.min(14, Math.max(8, 36 / (count - 1)));
  const start = 50 - (step * (count - 1)) / 2;
  return Array.from({ length: count }, (_, index) =>
    Number(Math.min(92, Math.max(8, start + step * index)).toFixed(1))
  );
}

function lateralPositionsForLine(players, count) {
  if (count <= 0) return [];
  const centerLike = players.filter(isCenterForwardLike);
  if (centerLike.length === count) {
    return centerForwardLateralSlots(count);
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
    const lateralSlots = lateralPositionsForLine(picked, picked.length);
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
      const lateralSlots = lateralPositionsForLine(leftovers, leftovers.length);
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
    gridX: Number(player.gridX ?? 50),
    gridY: Number(player.gridY ?? 50),
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
    const allCenterForwards = group.every(({ player }) => isCenterForwardLike(player));
    const step =
      allCenterForwards && group.length === 2
        ? 8
        : Math.max(lateralStep, 12 / Math.max(1, group.length - 1));

    group.forEach((entry, slot) => {
      const offset = (slot - (group.length - 1) / 2) * step;
      adjusted[entry.index] = {
        ...entry.player,
        gridX: baseX,
        gridY: Number(Math.min(98, Math.max(2, baseY + offset)).toFixed(1)),
      };
    });
  }

  return spreadForwardCenterClusters(adjusted);
}

/** Dos+ DC en línea de ataque con casi la misma Y → abrir en el centro (46/54). */
export function spreadForwardCenterClusters(players) {
  if (!players?.length) return players ?? [];

  const clusters = players
    .map((player, index) => ({ player, index }))
    .filter(({ player }) => {
      if (mapFootballDataPositionText(player.positionDetail ?? player.position) !== 'FWD') {
        return false;
      }
      if (!isCenterForwardLike(player)) return false;
      return Number(player.gridX ?? 0) >= 68;
    });

  if (clusters.length < 2) return players;

  const ys = clusters.map(({ player }) => Number(player.gridY ?? 50));
  if (Math.max(...ys) - Math.min(...ys) > 10) return players;

  const sorted = [...clusters].sort(
    (a, b) => (Number(a.player.shirtNumber) || 99) - (Number(b.player.shirtNumber) || 99)
  );
  const slots = centerForwardLateralSlots(sorted.length);
  const result = [...players];
  sorted.forEach(({ index }, slot) => {
    result[index] = { ...result[index], gridY: slots[slot] };
  });
  return result;
}
