/** Posiciones en cancha (0–100) a partir de formación táctica o grid API-Football. */

const DEFAULT_FORMATION = '4-3-3';

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

/**
 * API-Football grid "row:col" — fila 1 = portería propia, columna izq→der.
 * @returns {{ gridX: number, gridY: number } | null}
 */
export function parseApiFootballGrid(grid) {
  const text = String(grid ?? '').trim();
  if (!text) return null;
  const [rowRaw, colRaw] = text.split(':');
  const row = Number(rowRaw);
  const col = Number(colRaw);
  if (!Number.isFinite(row) || !Number.isFinite(col) || row < 1 || col < 1) return null;

  const rows = parseFormationString(DEFAULT_FORMATION);
  const maxRow = rows.reduce((sum, n) => sum + n, 0) > 0 ? rows.length : 4;
  const maxCol = 5;

  const depth = ((row - 1) / Math.max(maxRow - 1, 1)) * 100;
  const lateral = ((col - 1) / Math.max(maxCol - 1, 1)) * 100;
  return {
    gridX: Number(depth.toFixed(1)),
    gridY: Number(lateral.toFixed(1)),
  };
}

/**
 * Asigna coordenadas normalizadas a N jugadores según formación.
 * gridX: 0 = portería propia, 100 = línea rival; gridY: 0 = izquierda, 100 = derecha.
 */
export function assignFormationGrid(formation, playerCount = 11) {
  const rows = parseFormationString(formation);
  const slots = [];
  const rowCount = rows.length;

  rows.forEach((count, rowIndex) => {
    for (let i = 0; i < count; i += 1) {
      const depth =
        rowCount <= 1 ? 50 : (rowIndex / (rowCount - 1)) * 100;
      const lateral = count <= 1 ? 50 : (i / (count - 1)) * 100;
      slots.push({
        gridX: Number(depth.toFixed(1)),
        gridY: Number(lateral.toFixed(1)),
      });
    }
  });

  return slots.slice(0, playerCount);
}

/** Combina grid API-Football con fallback por formación. */
export function mergePlayerGrids(players, formation) {
  const fallbackSlots = assignFormationGrid(formation, players.length);
  return players.map((player, index) => {
    const fromApi = player.gridRaw ? parseApiFootballGrid(player.gridRaw) : null;
    const coords = fromApi ?? fallbackSlots[index] ?? { gridX: 50, gridY: 50 };
    const { gridRaw: _gridRaw, ...rest } = player;
    return { ...rest, gridX: coords.gridX, gridY: coords.gridY };
  });
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
