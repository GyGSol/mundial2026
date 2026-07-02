/** Layout 8→4→2→1 para cuadro Copa Fubols (jugadores). */

export const FUBOLS_CUP_BRACKET_COLS = 4;
export const FUBOLS_CUP_BRACKET_ROWS = 8;

/** @type {Record<string, { col: number, rowStart: number, rowSpan: number, parents?: string[] }>} */
export const FUBOLS_CUP_BRACKET_NODES = {
  'r1-0': { col: 1, rowStart: 1, rowSpan: 2, parents: [] },
  'r1-1': { col: 1, rowStart: 3, rowSpan: 2, parents: [] },
  'r1-2': { col: 1, rowStart: 5, rowSpan: 2, parents: [] },
  'r1-3': { col: 1, rowStart: 7, rowSpan: 2, parents: [] },

  'r2-0': { col: 2, rowStart: 2, rowSpan: 3, parents: ['r1-0', 'r1-3'] },
  'r2-1': { col: 2, rowStart: 5, rowSpan: 3, parents: ['r1-1', 'r1-2'] },

  'r3-0': { col: 3, rowStart: 3, rowSpan: 4, parents: ['r2-0', 'r2-1'] },

  'r4-0': { col: 4, rowStart: 4, rowSpan: 2, parents: ['r3-0'] },
};

export const FUBOLS_CUP_DUEL_NODE_IDS = [
  ['r1-0', 'r1-1', 'r1-2', 'r1-3'],
  ['r2-0', 'r2-1'],
  ['r3-0'],
  ['r4-0'],
];

export function duelNodeId(roundIndex, duelIndex) {
  return FUBOLS_CUP_DUEL_NODE_IDS[roundIndex]?.[duelIndex] ?? `r${roundIndex + 1}-${duelIndex}`;
}

export function getFubolsCupConnectors() {
  const pairs = [];
  for (const [id, node] of Object.entries(FUBOLS_CUP_BRACKET_NODES)) {
    for (const parent of node.parents ?? []) {
      pairs.push({ from: parent, to: id });
    }
  }
  return pairs;
}

export function getFubolsCupNodeCenter(node) {
  return {
    col: node.col,
    row: node.rowStart + (node.rowSpan - 1) / 2,
  };
}
