/** Mirrors backend economy config for UI-only constants */
export const MOCK_CHECKOUT_DELAY_MS = 2000;
export const GROUP_ENTRY_FEE = 100;
export const AI_CONSULTATION_FEE = 1;
export const AI_QUESTIONS_PER_FEE = 3;
export const DEFAULT_PRIZE_SPLITS = [50, 30, 20];

export const TX_TYPE_LABELS = {
  deposit: 'Ingreso',
  entry_fee: 'Inscripción',
  prize_payout: 'Premio',
  withdrawal: 'Retiro',
  welcome_bonus: 'Bono de bienvenida',
  ai_play_bonus: 'Bono para consultas IA',
  ai_consultation: 'Consulta IA',
  house_retention: 'La Casa',
};

export function formatFubolAmount(amount) {
  const n = Number(amount) || 0;
  const prefix = n > 0 ? '+' : '';
  return `${prefix}${n}`;
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

export function formatPrizeDistributionLabel(percents) {
  if (!percents?.length) return '';
  return percents.map((percent, index) => `${index + 1}° ${percent}%`).join(' · ');
}
