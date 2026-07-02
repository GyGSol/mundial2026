/** Copa Fubols — alineación con octavos→final del Mundial (externalId 89–104). */

export const FUBOLS_CUP_ROUND_OF_32_MIN = 73;
export const FUBOLS_CUP_ROUND_OF_32_MAX = 88;

export const FUBOLS_CUP_MIN_HUMANS = 8;

/** Cruces iniciales por semilla (1-based rank en tabla). */
export const FUBOLS_CUP_FIRST_ROUND_PAIRINGS = [
  [1, 8],
  [2, 7],
  [3, 6],
  [4, 5],
];

/**
 * Avance en el cuadro: cada entrada indica de qué duelos sale cada lado del cruce.
 * roundIndex 0 = octavos Copa (WC 89–96).
 */
export const FUBOLS_CUP_BRACKET_ADVANCEMENT = [
  {
    roundIndex: 1,
    duelIndex: 0,
    playerASource: { roundIndex: 0, duelIndex: 0 },
    playerBSource: { roundIndex: 0, duelIndex: 3 },
  },
  {
    roundIndex: 1,
    duelIndex: 1,
    playerASource: { roundIndex: 0, duelIndex: 1 },
    playerBSource: { roundIndex: 0, duelIndex: 2 },
  },
  {
    roundIndex: 2,
    duelIndex: 0,
    playerASource: { roundIndex: 1, duelIndex: 0 },
    playerBSource: { roundIndex: 1, duelIndex: 1 },
  },
  {
    roundIndex: 3,
    duelIndex: 0,
    playerASource: { roundIndex: 2, duelIndex: 0, slot: 'A' },
    playerBSource: { roundIndex: 2, duelIndex: 0, slot: 'B' },
  },
];

export const FUBOLS_CUP_ROUNDS = [
  {
    roundKey: 'round_of_16',
    label: 'Octavos de final',
    externalIds: ['89', '90', '91', '92', '93', '94', '95', '96'],
    duelCount: 4,
  },
  {
    roundKey: 'quarter_final',
    label: 'Cuartos de final',
    externalIds: ['97', '98', '99', '100'],
    duelCount: 2,
  },
  {
    roundKey: 'semi_final',
    label: 'Semifinales',
    externalIds: ['101', '102'],
    duelCount: 1,
    bothAdvanceToNextRound: true,
  },
  {
    roundKey: 'final',
    label: 'Final',
    externalIds: ['103', '104'],
    duelCount: 1,
  },
];

export function getWorldCupExternalIdsForDuel(roundKey, duelIndex) {
  const round = FUBOLS_CUP_ROUNDS.find((row) => row.roundKey === roundKey);
  if (!round) return [];
  const start = duelIndex * 2;
  return round.externalIds.slice(start, start + 2);
}

export function isRoundOf32Complete(finishedExternalIds) {
  const finished = new Set(finishedExternalIds.map(String));
  for (let id = FUBOLS_CUP_ROUND_OF_32_MIN; id <= FUBOLS_CUP_ROUND_OF_32_MAX; id += 1) {
    if (!finished.has(String(id))) return false;
  }
  return true;
}

export function buildEmptyBracketRounds() {
  return FUBOLS_CUP_ROUNDS.map((round) => ({
    roundKey: round.roundKey,
    label: round.label,
    worldCupExternalIds: [...round.externalIds],
    duels: Array.from({ length: round.duelCount }, (_, duelIndex) => ({
      duelId: `${round.roundKey}:${duelIndex}`,
      duelIndex,
      playerAId: null,
      playerBId: null,
      playerAName: null,
      playerBName: null,
      seedA: null,
      seedB: null,
      winnerId: null,
      matchResults: [],
      resolvedAt: null,
      advancePaidAt: null,
    })),
  }));
}
