/** Colores por grupo (A–L): 1.º oscuro, 2.º medio, 3.º claro (posible clasificado). */

export const GROUP_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

/** @type {Record<string, { dark: string, mid: string, light: string, label: string }>} */
export const GROUP_COLORS = {
  A: { dark: '#15803d', mid: '#16a34a', light: '#86efac', label: 'Verde' },
  B: { dark: '#1d4ed8', mid: '#3b82f6', light: '#93c5fd', label: 'Azul' },
  C: { dark: '#b45309', mid: '#d97706', light: '#fcd34d', label: 'Ámbar' },
  D: { dark: '#b91c1c', mid: '#dc2626', light: '#fca5a5', label: 'Rojo' },
  E: { dark: '#7e22ce', mid: '#9333ea', light: '#d8b4fe', label: 'Violeta' },
  F: { dark: '#0f766e', mid: '#14b8a6', light: '#99f6e4', label: 'Turquesa' },
  G: { dark: '#4d7c0f', mid: '#65a30d', light: '#bef264', label: 'Lima' },
  H: { dark: '#c2410c', mid: '#ea580c', light: '#fdba74', label: 'Naranja' },
  I: { dark: '#4338ca', mid: '#6366f1', light: '#a5b4fc', label: 'Índigo' },
  J: { dark: '#be185d', mid: '#db2777', light: '#f9a8d4', label: 'Rosa' },
  K: { dark: '#0369a1', mid: '#0284c7', light: '#7dd3fc', label: 'Cielo' },
  L: { dark: '#6d28d9', mid: '#8b5cf6', light: '#c4b5fd', label: 'Púrpura' },
};

export function getGroupColor(group, position) {
  const palette = GROUP_COLORS[String(group || '').toUpperCase()];
  if (!palette || !position) return null;
  if (position === 1) return palette.dark;
  if (position === 2) return palette.mid;
  if (position === 3) return palette.light;
  return null;
}

export function getGroupRowBorderStyle(group, rank) {
  const color = getGroupColor(group, rank);
  if (!color) {
    return { borderLeftWidth: 2, borderLeftColor: 'transparent' };
  }
  return { borderLeftWidth: 4, borderLeftColor: color };
}

export function parseKnockoutSlotLabel(label) {
  const trimmed = String(label || '').trim();
  if (!trimmed) return null;

  let match = trimmed.match(/^1\.º del grupo ([A-L])$/i);
  if (match) {
    return { type: 'group_position', position: 1, group: match[1].toUpperCase() };
  }

  match = trimmed.match(/^2\.º del grupo ([A-L])$/i);
  if (match) {
    return { type: 'group_position', position: 2, group: match[1].toUpperCase() };
  }

  match = trimmed.match(/^3\.º mejor \(([^)]+)\)$/i);
  if (match) {
    const groups = match[1]
      .split('/')
      .map((g) => g.trim().toUpperCase())
      .filter((g) => GROUP_COLORS[g]);
    return { type: 'third_best', position: 3, groups };
  }

  match = trimmed.match(/^Ganador de (.+) vs (.+)$/i);
  if (match) return { type: 'match_winner', matchId: null, homePart: match[1].trim(), awayPart: match[2].trim() };

  match = trimmed.match(/^Perdedor de (.+) vs (.+)$/i);
  if (match) return { type: 'match_loser', matchId: null, homePart: match[1].trim(), awayPart: match[2].trim() };

  match = trimmed.match(/^Ganador del partido (\d+)$/i);
  if (match) return { type: 'match_winner', matchId: match[1] };

  match = trimmed.match(/^Perdedor del partido (\d+)$/i);
  if (match) return { type: 'match_loser', matchId: match[1] };

  return { type: 'unknown', text: trimmed };
}
