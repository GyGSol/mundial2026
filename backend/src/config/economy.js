/** 10 USD = 100 Fubols → 10 Fubols per USD */
export const FUBOLS_PER_USD = 10;
export const GROUP_ENTRY_FEE = 100;
export const WELCOME_BONUS_FUBOLS = 100;
export const DEFAULT_PRIZE_SPLITS = [50, 30, 20];
export const MOCK_CHECKOUT_USD = 10;
export const MOCK_CHECKOUT_FUBOLS = MOCK_CHECKOUT_USD * FUBOLS_PER_USD;
export const MOCK_CHECKOUT_DELAY_MS = 2000;

export function usdToFubols(usd) {
  return Math.round(Number(usd) * FUBOLS_PER_USD);
}
