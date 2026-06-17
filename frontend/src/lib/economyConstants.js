/** Mirrors backend economy config for UI-only constants */
export const MOCK_CHECKOUT_DELAY_MS = 2000;
export const GROUP_ENTRY_FEE = 100;
export const AI_CONSULTATION_FEE = 1;

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
