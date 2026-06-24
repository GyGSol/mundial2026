/**
 * Asignación a cuadrícula táctica: una celda = un jugador.
 */

import { getGridTemplate, LATERAL } from './formationGridTemplates.js';

export const MIN_LATERAL_SEP = 18;
export const DEPTH_PROXIMITY = 6;
export const FINE_CELL_SIZE = 12;

const POOL_ORDER = { GK: 0, DEF: 1, MID: 2, FWD: 3 };

const ROLE_ALIASES = {
  POR: ['POR', 'GK', 'G', 'GOALKEEPER'],
  LI: ['LI', 'LEFT BACK', 'LEFT-BACK', 'LB'],
  LD: ['LD', 'RIGHT BACK', 'RIGHT-BACK', 'RB'],
  DFC: ['DFC', 'DF', 'DEF', 'CENTRE-BACK', 'CENTER BACK', 'CB'],
  MCD: ['MCD', 'DEFENSIVE MID', 'DEFENSIVE MIDFIELD', 'CDM', 'DM'],
  MC: ['MC', 'CENTRAL MID', 'CENTRAL MIDFIELD', 'CM'],
  MCO: ['MCO', 'ATTACKING MID', 'ATTACKING MIDFIELD', 'CAM', 'AM'],
  MI: ['MI', 'LEFT MID', 'LEFT MIDFIELD', 'LM'],
  MD: ['MD', 'RIGHT MID', 'RIGHT MIDFIELD', 'RM'],
  CAI: ['CAI', 'LEFT WING-BACK', 'LWB', 'LEFT WING BACK'],
  CAD: ['CAD', 'RIGHT WING-BACK', 'RWB', 'RIGHT WING BACK'],
  EI: ['EI', 'LEFT WING', 'LEFT WINGER', 'LW'],
  ED: ['ED', 'RIGHT WING', 'RIGHT WINGER', 'RW'],
  DC: ['DC', 'CF', 'ST', 'CENTRE-FORWARD', 'CENTER FORWARD', 'STRIKER', 'FW', 'FWD'],
  SD: ['SD', 'SECOND STRIKER', 'SECOND FORWARD', 'SS'],
};

function mapPool(text) {
  const p = String(text ?? '').trim().toUpperCase();
  if (!p) return 'MID';
  if (p.includes('GOALKEEPER') || p === 'GK' || p === 'G' || p === 'POR') return 'GK';
  if (p === 'DF' || p === 'DEF' || p.includes('BACK') || p.includes('DEFEN')) return 'DEF';
  if (p === 'FW' || p === 'FWD' || p.includes('FORWARD') || p.includes('STRIKER') || p === 'ST') {
    return 'FWD';
  }
  if (p === 'MF' || p === 'MID' || p.includes('MID')) return 'MID';
  return 'MID';
}

function playerTokens(player) {
  const detail = String(player?.positionDetail ?? '').trim();
  const coarse = String(player?.position ?? '').trim();
  const tokens = new Set();
  if (detail) {
    tokens.add(detail.split(/\s+/)[0].toUpperCase());
    tokens.add(detail.toUpperCase());
  }
  if (coarse) tokens.add(coarse.toUpperCase());
  return tokens;
}

function poolForPlayer(player) {
  return mapPool(player?.positionDetail ?? player?.position);
}

function roleMatchesCell(player, cellRole) {
  const aliases = ROLE_ALIASES[cellRole] ?? [cellRole];
  const tokens = playerTokens(player);
  const text = `${player?.positionDetail ?? ''} ${player?.position ?? ''}`.toUpperCase();

  for (const alias of aliases) {
    if (tokens.has(alias)) return true;
    if (alias.length <= 3) {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`\\b${escaped}\\b`).test(text)) return true;
    } else if (text.includes(alias)) {
      return true;
    }
  }
  return false;
}

function roleScore(player, cellRole) {
  if (roleMatchesCell(player, cellRole)) return 100;

  const pool = poolForPlayer(player);
  const cellPool =
    cellRole === 'POR'
      ? 'GK'
      : ['LI', 'LD', 'DFC', 'CAI', 'CAD'].includes(cellRole)
        ? 'DEF'
        : ['EI', 'ED', 'DC', 'SD'].includes(cellRole)
          ? 'FWD'
          : 'MID';

  if (pool === cellPool) return 40;
  if (pool === 'MID' && cellPool === 'FWD') return 20;
  if (pool === 'FWD' && cellPool === 'MID') return 15;
  return 0;
}

function cellDepthBand(gridX) {
  const x = Number(gridX);
  if (x < 18) return 'GK';
  if (x < 44) return 'DEF';
  if (x < 76) return 'MID';
  return 'ATT';
}

function poolDepthBand(pool) {
  if (pool === 'GK') return 'GK';
  if (pool === 'DEF') return 'DEF';
  if (pool === 'FWD') return 'ATT';
  return 'MID';
}

function distanceSq(ax, ay, bx, by) {
  return (ax - bx) ** 2 + (ay - by) ** 2;
}

function findNearestFreeCell(player, cells, occupied, preferSameBand = true) {
  const pool = poolForPlayer(player);
  const band = poolDepthBand(pool);
  let best = null;
  let bestDist = Infinity;

  for (const cell of cells) {
    if (occupied.has(cell.id)) continue;
    const cellBand = cellDepthBand(cell.gridX);
    if (preferSameBand && cellBand !== band && pool !== 'MID') continue;

    const dist = distanceSq(
      Number(player.gridX ?? 50),
      Number(player.gridY ?? 50),
      cell.gridX,
      cell.gridY
    );
    if (dist < bestDist) {
      bestDist = dist;
      best = cell;
    }
  }

  if (!best) {
    for (const cell of cells) {
      if (occupied.has(cell.id)) continue;
      const dist = distanceSq(50, 50, cell.gridX, cell.gridY);
      if (dist < bestDist) {
        bestDist = dist;
        best = cell;
      }
    }
  }

  return best;
}

function assignPlayerToCell(player, cell) {
  return {
    ...player,
    gridX: Number(cell.gridX.toFixed(1)),
    gridY: Number(cell.gridY.toFixed(1)),
    pitchGridRole: cell.role,
    pitchGridCellId: cell.id,
  };
}

/**
 * Asigna jugadores a celdas de la plantilla (score por rol, fallback celda libre).
 * @param {object[]} players
 * @param {string} formation
 */
export function assignPlayersToPitchGrid(players, formation = '4-3-3') {
  if (!players?.length) return [];

  const cells = getGridTemplate(formation);
  const occupied = new Set();
  const assigned = [];
  const unassigned = [...players];

  const sortedCells = [...cells].sort((a, b) => {
    const poolA = a.role === 'POR' ? 0 : ['LI', 'LD', 'DFC', 'CAI', 'CAD'].includes(a.role) ? 1 : ['EI', 'ED', 'DC', 'SD'].includes(a.role) ? 3 : 2;
    const poolB = b.role === 'POR' ? 0 : ['LI', 'LD', 'DFC', 'CAI', 'CAD'].includes(b.role) ? 1 : ['EI', 'ED', 'DC', 'SD'].includes(b.role) ? 3 : 2;
    return poolA - poolB || a.gridX - b.gridX;
  });

  for (const cell of sortedCells) {
    let bestIdx = -1;
    let bestScore = -1;

    unassigned.forEach((player, index) => {
      const score =
        roleScore(player, cell.role) * 10 -
        Math.abs(POOL_ORDER[poolForPlayer(player)] - (cell.role === 'POR' ? 0 : 2));
      if (score > bestScore) {
        bestScore = score;
        bestIdx = index;
      }
    });

    if (bestIdx < 0) continue;

    const [player] = unassigned.splice(bestIdx, 1);
    occupied.add(cell.id);
    assigned.push(assignPlayerToCell(player, cell));
  }

  for (const player of unassigned) {
    const cell = findNearestFreeCell(player, cells, occupied);
    if (!cell) continue;
    occupied.add(cell.id);
    assigned.push(assignPlayerToCell(player, cell));
  }

  return assigned.sort(
    (a, b) =>
      (Number(a.shirtNumber) || 99) - (Number(b.shirtNumber) || 99) ||
      String(a.name ?? '').localeCompare(String(b.name ?? ''))
  );
}

export function fineCellKey(gridX, gridY, cellSize = FINE_CELL_SIZE) {
  const x = Number(gridX ?? 50);
  const y = Number(gridY ?? 50);
  return `${Math.round(x / cellSize)}:${Math.round(y / cellSize)}`;
}

function playerPriority(player) {
  const pool = poolForPlayer(player);
  return (POOL_ORDER[pool] ?? 2) * 1000 + (Number(player.shirtNumber) || 99);
}

function allFineCells() {
  const cells = [];
  for (let x = FINE_CELL_SIZE / 2; x <= 100; x += FINE_CELL_SIZE) {
    for (let y = FINE_CELL_SIZE / 2; y <= 100; y += FINE_CELL_SIZE) {
      if (x < 4 || x > 96) continue;
      cells.push({ gridX: x, gridY: y });
    }
  }
  return cells;
}

const FINE_CELL_CACHE = allFineCells();

function nearestEmptyFineCell(gridX, gridY, occupiedKeys) {
  let best = { gridX, gridY };
  let bestDist = Infinity;
  for (const cell of FINE_CELL_CACHE) {
    const key = fineCellKey(cell.gridX, cell.gridY);
    if (occupiedKeys.has(key)) continue;
    const dist = distanceSq(gridX, gridY, cell.gridX, cell.gridY);
    if (dist < bestDist) {
      bestDist = dist;
      best = cell;
    }
  }
  return best;
}

/**
 * Garantiza una celda fina por jugador y separación lateral mínima en la misma profundidad.
 */
function normalizeGridCoords(players) {
  return players.map((p) => {
    if (poolForPlayer(p) === 'GK') {
      return {
        ...p,
        gridX: Number((p.gridX ?? 6).toFixed(1)),
        gridY: LATERAL.CENTER,
      };
    }
    return {
      ...p,
      gridX: Number(Number(p.gridX ?? 50).toFixed(1)),
      gridY: Number(Number(p.gridY ?? 50).toFixed(1)),
    };
  });
}

export function enforceUniquePitchCells(players, { minLateralSep = MIN_LATERAL_SEP } = {}) {
  if (!players?.length) return players ?? [];

  const incoming = players.map((p) => ({ ...p }));
  const gridPlaced = incoming.filter((p) => p.pitchGridCellId);
  if (gridPlaced.length === incoming.length) {
    const normalized = normalizeGridCoords(incoming);
    const uniqueCells = new Set(normalized.map((p) => p.pitchGridCellId)).size === normalized.length;
    if (uniqueCells && assertNoPitchOverlaps(normalized, { minLateralSep }).length === 0) {
      return normalized;
    }
  }

  let result = incoming;

  const placeGk = () => {
    for (let i = 0; i < result.length; i += 1) {
      if (poolForPlayer(result[i]) === 'GK') {
        result[i] = {
          ...result[i],
          gridX: Number((result[i].gridX ?? 6).toFixed(1)),
          gridY: LATERAL.CENTER,
        };
      }
    }
  };

  placeGk();

  const occupiedKeys = () => {
    const keys = new Set();
    result.forEach((p, idx) => {
      if (poolForPlayer(p) === 'GK') return;
      keys.add(fineCellKey(p.gridX, p.gridY));
    });
    return keys;
  };

  for (let i = 0; i < result.length; i += 1) {
    if (poolForPlayer(result[i]) === 'GK') continue;
    let gx = Number(result[i].gridX ?? 50);
    let gy = Number(result[i].gridY ?? 50);
    const keys = occupiedKeys();
    const key = fineCellKey(gx, gy);
    if (!keys.has(key) || keys.size === 0) {
      result[i] = { ...result[i], gridX: Number(gx.toFixed(1)), gridY: Number(gy.toFixed(1)) };
      continue;
    }
    const next = nearestEmptyFineCell(gx, gy, keys);
    result[i] = {
      ...result[i],
      gridX: Number(next.gridX.toFixed(1)),
      gridY: Number(next.gridY.toFixed(1)),
    };
  }

  for (let pass = 0; pass < 8; pass += 1) {
    let moved = false;
    for (let i = 0; i < result.length; i += 1) {
      for (let j = i + 1; j < result.length; j += 1) {
        const a = result[i];
        const b = result[j];
        if (poolForPlayer(a) === 'GK' || poolForPlayer(b) === 'GK') continue;

        const dx = Math.abs(Number(a.gridX) - Number(b.gridX));
        const dy = Math.abs(Number(a.gridY) - Number(b.gridY));
        if (dx > DEPTH_PROXIMITY || dy >= minLateralSep) continue;

        const moveIdx = playerPriority(a) > playerPriority(b) ? i : j;
        const mover = result[moveIdx];

        const keys = new Set();
        result.forEach((p, idx) => {
          if (idx === moveIdx) return;
          keys.add(fineCellKey(p.gridX, p.gridY));
        });

        const candidates = FINE_CELL_CACHE.filter((cell) => {
          const ck = fineCellKey(cell.gridX, cell.gridY);
          if (keys.has(ck)) return false;
          return Math.abs(cell.gridX - Number(mover.gridX)) <= 20;
        });

        const sorted = (candidates.length ? candidates : FINE_CELL_CACHE).sort(
          (c1, c2) =>
            distanceSq(c1.gridX, c1.gridY, mover.gridX, mover.gridY) -
            distanceSq(c2.gridX, c2.gridY, mover.gridX, mover.gridY)
        );

        for (const cell of sorted) {
          let ok = true;
          for (let k = 0; k < result.length; k += 1) {
            if (k === moveIdx) continue;
            const other = result[k];
            if (poolForPlayer(other) === 'GK') continue;
            const odx = Math.abs(Number(other.gridX) - cell.gridX);
            const ody = Math.abs(Number(other.gridY) - cell.gridY);
            if (odx <= DEPTH_PROXIMITY && ody < minLateralSep) {
              ok = false;
              break;
            }
          }
          if (ok) {
            result[moveIdx] = {
              ...mover,
              gridX: Number(cell.gridX.toFixed(1)),
              gridY: Number(cell.gridY.toFixed(1)),
            };
            moved = true;
            break;
          }
        }
      }
    }
    if (!moved) break;
  }

  return result;
}

export function assertNoPitchOverlaps(players, { minLateralSep = MIN_LATERAL_SEP } = {}) {
  const issues = [];
  for (let i = 0; i < players.length; i += 1) {
    for (let j = i + 1; j < players.length; j += 1) {
      const a = players[i];
      const b = players[j];
      const dx = Math.abs(Number(a.gridX) - Number(b.gridX));
      const dy = Math.abs(Number(a.gridY) - Number(b.gridY));
      if (dx <= DEPTH_PROXIMITY && dy < minLateralSep) {
        issues.push({ a: a.name, b: b.name, dx, dy });
      }
    }
  }
  return issues;
}
