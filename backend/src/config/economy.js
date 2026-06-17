/** 10 USD = 100 Fubols → 10 Fubols per USD */
export const FUBOLS_PER_USD = 10;
export const GROUP_ENTRY_FEE = 100;
export const WELCOME_BONUS_FUBOLS = 100;
export const AI_PLAY_BONUS_FUBOLS = 10;
export const AI_CONSULTATION_FEE = 1;
export const AI_QUESTIONS_PER_FEE = 3;
export const DEFAULT_PRIZE_SPLITS = [50, 30, 20];
export const MOCK_CHECKOUT_USD = 10;
export const MOCK_CHECKOUT_FUBOLS = MOCK_CHECKOUT_USD * FUBOLS_PER_USD;
export const MOCK_CHECKOUT_DELAY_MS = 2000;

export function usdToFubols(usd) {
  return Math.round(Number(usd) * FUBOLS_PER_USD);
}

/** Porcentajes del pozo por puesto premiado (suman 100). */
export function computePrizeDistributionPercents(winnersCount) {
  const n = Math.max(0, Math.min(Math.floor(Number(winnersCount) || 0), 10));
  if (n === 0) return [];
  if (n === 1) return [100];
  if (n === 2) return [60, 40];
  if (n === 3) return [...DEFAULT_PRIZE_SPLITS];

  const base = Math.floor(100 / n);
  let remainder = 100 - base * n;
  return Array.from({ length: n }, () => {
    const extra = remainder > 0 ? 1 : 0;
    if (remainder > 0) remainder -= 1;
    return base + extra;
  });
}
