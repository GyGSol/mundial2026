/** 10 USD = 100 Fubols → 10 Fubols per USD */
export const FUBOLS_PER_USD = 10;
export const GROUP_ENTRY_FEE = 100;
export const WELCOME_BONUS_FUBOLS = 100;
export const AI_PLAY_BONUS_FUBOLS = 10;
export const AI_CONSULTATION_FEE = 1;
export const AI_QUESTIONS_PER_FEE = 3;
export const MOCK_CHECKOUT_USD = 10;
export const MOCK_CHECKOUT_FUBOLS = MOCK_CHECKOUT_USD * FUBOLS_PER_USD;
export const MOCK_CHECKOUT_DELAY_MS = 2000;

export function usdToFubols(usd) {
  return Math.round(Number(usd) * FUBOLS_PER_USD);
}

/**
 * Porcentajes del pozo por puesto premiado (suman 100).
 * Peso por posición: 1° = n, 2° = n-1, …, n° = 1 (más alto arriba).
 */
export function computePrizeDistributionPercents(winnersCount) {
  const n = Math.max(0, Math.min(Math.floor(Number(winnersCount) || 0), 10));
  if (n === 0) return [];
  if (n === 1) return [100];

  const totalWeight = (n * (n + 1)) / 2;
  const exact = Array.from({ length: n }, (_, i) => (100 * (n - i)) / totalWeight);
  const floors = exact.map((v) => Math.floor(v));
  let remainder = 100 - floors.reduce((sum, p) => sum + p, 0);

  const byFrac = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);

  const percents = [...floors];
  for (let j = 0; j < remainder; j += 1) {
    percents[byFrac[j].i] += 1;
  }
  return percents;
}

/** Reparto por defecto al crear pozo (top 3). */
export const DEFAULT_PRIZE_SPLITS = computePrizeDistributionPercents(3);
