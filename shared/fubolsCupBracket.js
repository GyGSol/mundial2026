/** Copa Fubols — 8 humanos: cuartos (WC octavos 89–96) → semis (WC cuartos 97–100) → 3.er (103) + final (101+102+104). */

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
 * Avance en el cuadro humano (roundIndex 0 = cuartos Copa).
 * Fuentes sin slot = ganador del duelo previo; slot loser = perdedor del duelo previo.
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
    playerASource: { roundIndex: 1, duelIndex: 0, slot: 'loser' },
    playerBSource: { roundIndex: 1, duelIndex: 1, slot: 'loser' },
  },
  {
    roundIndex: 3,
    duelIndex: 0,
    playerASource: { roundIndex: 1, duelIndex: 0 },
    playerBSource: { roundIndex: 1, duelIndex: 1 },
  },
];

export const FUBOLS_CUP_ROUNDS = [
  {
    roundKey: 'quarter_final',
    label: 'Cuartos de final',
    externalIds: ['89', '90', '91', '92', '93', '94', '95', '96'],
    duelCount: 4,
    matchesPerDuel: 2,
  },
  {
    roundKey: 'semi_final',
    label: 'Semifinales',
    externalIds: ['97', '98', '99', '100'],
    duelCount: 2,
    matchesPerDuel: 2,
  },
  {
    roundKey: 'third_place',
    label: 'Tercer puesto',
    externalIds: ['103'],
    duelCount: 1,
    matchesPerDuel: 1,
  },
  {
    roundKey: 'final',
    label: 'Final',
    externalIds: ['101', '102', '104'],
    duelCount: 1,
    matchesPerDuel: 3,
  },
];

export function areConsecutiveExternalIds(a, b) {
  const na = Number.parseInt(String(a), 10);
  const nb = Number.parseInt(String(b), 10);
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return false;
  return Math.abs(na - nb) === 1;
}

export function getWorldCupExternalIdsForDuel(roundKey, duelIndex) {
  const round = FUBOLS_CUP_ROUNDS.find((row) => row.roundKey === roundKey);
  if (!round) return [];
  const perDuel = round.matchesPerDuel ?? 2;
  const start = duelIndex * perDuel;
  return round.externalIds.slice(start, start + perDuel);
}

/** PRNG determinístico (FNV-1a + mulberry32) para mezclar partidos con la misma semilla. */
export function createSeededRng(seed) {
  let h = 2166136261;
  const s = String(seed);
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fisherYates(array, rng) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/** Reparte IDs en pares sin números consecutivos (p. ej. evita 91+92 en el mismo cruce). */
export function shuffleNonConsecutiveDuelPairs(externalIds, duelCount, seed) {
  const ids = externalIds.map(String);
  const perDuel = Math.max(1, Math.floor(ids.length / duelCount));
  if (perDuel < 2) {
    const rng = createSeededRng(seed);
    const shuffled = fisherYates([...ids], rng);
    return shuffled.map((id) => [id]);
  }

  const rng = createSeededRng(seed);
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const shuffled = fisherYates([...ids], rng);
    const pairs = [];
    let valid = true;
    for (let i = 0; i < duelCount; i += 1) {
      const a = shuffled[i * perDuel];
      const b = shuffled[i * perDuel + 1];
      if (!a || !b || areConsecutiveExternalIds(a, b)) {
        valid = false;
        break;
      }
      pairs.push(rng() < 0.5 ? [b, a] : [a, b]);
    }
    if (valid) return pairs;
  }

  const odds = ids.filter((id) => Number.parseInt(id, 10) % 2 === 1);
  const evens = ids.filter((id) => Number.parseInt(id, 10) % 2 === 0);
  fisherYates(odds, rng);
  fisherYates(evens, rng);
  return Array.from({ length: duelCount }, (_, i) => {
    const odd = odds[i % odds.length];
    let even = evens[i % evens.length];
    if (areConsecutiveExternalIds(odd, even)) {
      even = evens[(i + 1) % evens.length];
    }
    return rng() < 0.5 ? [even, odd] : [odd, even];
  });
}

export function sortWorldCupExternalIdsChronological(externalIds) {
  return [...externalIds].map(String).sort((a, b) => Number(a) - Number(b));
}

/** Mezcla qué partidos WC corresponde a cada cruce de una ronda. */
export function shuffleWorldCupMatchAssignmentsForRound(roundKey, seed) {
  const round = FUBOLS_CUP_ROUNDS.find((row) => row.roundKey === roundKey);
  if (!round) return [];

  if (round.duelCount === 1 && round.externalIds.length > 1) {
    return [sortWorldCupExternalIdsChronological(round.externalIds)];
  }

  const perDuel = round.matchesPerDuel ?? 2;
  if (perDuel === 1 && round.duelCount === round.externalIds.length) {
    const rng = createSeededRng(`${seed}:${roundKey}`);
    const shuffled = fisherYates([...round.externalIds], rng);
    return shuffled.map((id) => [String(id)]);
  }

  if (perDuel >= 2) {
    return shuffleNonConsecutiveDuelPairs(round.externalIds, round.duelCount, `${seed}:${roundKey}`);
  }

  return Array.from({ length: round.duelCount }, (_, duelIndex) => [
    ...getWorldCupExternalIdsForDuel(roundKey, duelIndex),
  ]);
}

export function applyShuffledMatchAssignmentsToRounds(rounds, seed) {
  return reconcileWorldCupMatchAssignments(rounds, seed, { onlyUnresolved: false });
}

/** Reasigna partidos WC según config actual; por defecto solo duelos sin resolver. */
export function reconcileWorldCupMatchAssignments(rounds, seed, { onlyUnresolved = true } = {}) {
  if (!seed || !rounds?.length) return rounds;

  const configByKey = Object.fromEntries(
    FUBOLS_CUP_ROUNDS.map((row) => [row.roundKey, row])
  );

  for (const round of rounds) {
    const config = configByKey[round.roundKey];
    if (config) {
      round.worldCupExternalIds = [...config.externalIds];
    }

    const assignments = shuffleWorldCupMatchAssignmentsForRound(round.roundKey, seed);
    for (let i = 0; i < round.duels.length; i += 1) {
      const duel = round.duels[i];
      if (onlyUnresolved && duel.resolvedAt) continue;
      if (assignments[i]?.length >= 1) {
        duel.worldCupExternalIds = assignments[i].map(String);
      }
    }
  }
  return rounds;
}

export function getDuelWorldCupExternalIds(round, duelIndex) {
  const duel = round?.duels?.[duelIndex];
  if (duel?.worldCupExternalIds?.length > 0) {
    return duel.worldCupExternalIds.map(String);
  }
  if (round?.roundKey) {
    return getWorldCupExternalIdsForDuel(round.roundKey, duelIndex);
  }
  return [];
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
      worldCupExternalIds: null,
      matchResults: [],
      resolvedAt: null,
      advancePaidAt: null,
    })),
  }));
}
