/** FIFA World Cup 2026 — bracket fijo (partidos 73–104). */

export const OFFICIAL_KNOCKOUT_MATCH_IDS = [
  '73', '74', '75', '76', '77', '78', '79', '80',
  '81', '82', '83', '84', '85', '86', '87', '88',
  '89', '90', '91', '92', '93', '94', '95', '96',
  '97', '98', '99', '100', '101', '102', '103', '104',
];

/** @type {Record<string, { round: string, col: number, rowStart: number, rowSpan: number, parents?: string[] }>} */
export const BRACKET_NODES = {
  73: { round: 'r32', col: 1, rowStart: 1, rowSpan: 2, parents: [] },
  75: { round: 'r32', col: 1, rowStart: 3, rowSpan: 2, parents: [] },
  74: { round: 'r32', col: 1, rowStart: 5, rowSpan: 2, parents: [] },
  77: { round: 'r32', col: 1, rowStart: 7, rowSpan: 2, parents: [] },
  83: { round: 'r32', col: 1, rowStart: 9, rowSpan: 2, parents: [] },
  84: { round: 'r32', col: 1, rowStart: 11, rowSpan: 2, parents: [] },
  81: { round: 'r32', col: 1, rowStart: 13, rowSpan: 2, parents: [] },
  82: { round: 'r32', col: 1, rowStart: 15, rowSpan: 2, parents: [] },

  90: { round: 'r16', col: 2, rowStart: 1, rowSpan: 4, parents: ['73', '75'] },
  89: { round: 'r16', col: 2, rowStart: 5, rowSpan: 4, parents: ['74', '77'] },
  93: { round: 'r16', col: 2, rowStart: 9, rowSpan: 4, parents: ['83', '84'] },
  94: { round: 'r16', col: 2, rowStart: 13, rowSpan: 4, parents: ['81', '82'] },

  97: { round: 'qf', col: 3, rowStart: 1, rowSpan: 8, parents: ['89', '90'] },
  98: { round: 'qf', col: 3, rowStart: 9, rowSpan: 8, parents: ['93', '94'] },

  101: { round: 'sf', col: 4, rowStart: 1, rowSpan: 16, parents: ['97', '98'] },

  104: { round: 'final', col: 5, rowStart: 7, rowSpan: 2, parents: ['101', '102'] },
  103: { round: 'third', col: 5, rowStart: 10, rowSpan: 2, parents: ['101', '102'] },

  102: { round: 'sf', col: 6, rowStart: 1, rowSpan: 16, parents: ['99', '100'] },

  99: { round: 'qf', col: 7, rowStart: 1, rowSpan: 8, parents: ['91', '92'] },
  100: { round: 'qf', col: 7, rowStart: 9, rowSpan: 8, parents: ['95', '96'] },

  91: { round: 'r16', col: 8, rowStart: 1, rowSpan: 4, parents: ['76', '78'] },
  92: { round: 'r16', col: 8, rowStart: 5, rowSpan: 4, parents: ['79', '80'] },
  95: { round: 'r16', col: 8, rowStart: 9, rowSpan: 4, parents: ['86', '88'] },
  96: { round: 'r16', col: 8, rowStart: 13, rowSpan: 4, parents: ['85', '87'] },

  76: { round: 'r32', col: 9, rowStart: 1, rowSpan: 2, parents: [] },
  78: { round: 'r32', col: 9, rowStart: 3, rowSpan: 2, parents: [] },
  79: { round: 'r32', col: 9, rowStart: 5, rowSpan: 2, parents: [] },
  80: { round: 'r32', col: 9, rowStart: 7, rowSpan: 2, parents: [] },
  86: { round: 'r32', col: 9, rowStart: 9, rowSpan: 2, parents: [] },
  88: { round: 'r32', col: 9, rowStart: 11, rowSpan: 2, parents: [] },
  85: { round: 'r32', col: 9, rowStart: 13, rowSpan: 2, parents: [] },
  87: { round: 'r32', col: 9, rowStart: 15, rowSpan: 2, parents: [] },
};

export const BRACKET_GRID_ROWS = 16;
export const BRACKET_GRID_COLS = 9;

export function indexKnockoutMatches(phases = []) {
  const map = new Map();
  for (const phase of phases) {
    for (const match of phase.matches ?? []) {
      map.set(String(match.externalId), match);
    }
  }
  return map;
}

export function isOfficialKnockoutBracket(phases = []) {
  if (!phases?.length) return false;
  const ids = phases.flatMap((p) => (p.matches ?? []).map((m) => String(m.externalId)));
  if (!ids.length) return false;
  return ids.every((id) => /^\d+$/.test(id));
}

export function getBracketConnectors() {
  const connectors = [];
  for (const [id, node] of Object.entries(BRACKET_NODES)) {
    for (const parentId of node.parents ?? []) {
      connectors.push({ from: parentId, to: id });
    }
  }
  return connectors;
}

export function getNodeCenter(node) {
  return {
    col: node.col,
    row: node.rowStart + (node.rowSpan - 1) / 2,
  };
}

export const ROUND_TITLES = {
  r32: 'Dieciseisavos',
  r16: 'Octavos',
  qf: 'Cuartos',
  sf: 'Semifinales',
  final: 'Final',
  third: '3er puesto',
};

/** Etiquetas de columna para el encabezado del bracket (cols 1–9). */
export const BRACKET_COLUMN_LABELS = {
  1: 'Dieciseisavos',
  2: 'Octavos',
  3: 'Cuartos',
  4: 'Semifinales',
  5: 'Final',
  6: 'Semifinales',
  7: 'Cuartos',
  8: 'Octavos',
  9: 'Dieciseisavos',
};
