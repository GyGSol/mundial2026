/** Mirrors backend economy config for UI-only constants */
export const MOCK_CHECKOUT_DELAY_MS = 2000;
export const GROUP_ENTRY_FEE = 100;
export const ELIMINATION_TOURNAMENT_PRIZE_FUBOLS = 100;
export const FUBOLS_CUP_CHAMPION_PRIZE = 1000;
export const FUBOLS_CUP_ROUND_ADVANCE_PRIZE = 100;

export function computeEliminationEntryFee(memberCount) {
  const members = Math.max(1, Math.floor(Number(memberCount) || 0));
  return Math.floor(ELIMINATION_TOURNAMENT_PRIZE_FUBOLS / members);
}
export const AI_CONSULTATION_FEE = 1;
export const AI_QUESTIONS_PER_FEE = 3;

export const TX_TYPE_LABELS = {
  deposit: 'Ingreso',
  entry_fee: 'Inscripción',
  elimination_entry_fee: 'Inscripción Torneo Eliminación',
  prize_payout: 'Premio',
  withdrawal: 'Retiro',
  welcome_bonus: 'Bono de bienvenida',
  ai_play_bonus: 'Bono para consultas IA',
  ai_consultation: 'Consulta IA',
  ai_entry_float: 'Fondo IA (inscripción)',
  house_retention: 'La Casa',
};

export function formatFubolAmount(amount) {
  const n = Number(amount) || 0;
  const prefix = n > 0 ? '+' : '';
  return `${prefix}${n}`;
}

/** Porcentajes del pozo por puesto premiado (suman 100). Peso decreciente por posición. */
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

export const DEFAULT_PRIZE_SPLITS = computePrizeDistributionPercents(3);

export function formatPrizeDistributionLabel(percents) {
  if (!percents?.length) return '';
  return percents.map((percent, index) => `${index + 1}° ${percent}%`).join(' · ');
}
