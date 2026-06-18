/** Ventana post-pitido en la que el partido sigue en la barra destacada. */
export const POST_FINISH_GRACE_MS = 30 * 60 * 1000;

/** Partido finalizado dentro de la ventana de gracia (requiere finishedAt del API). */
export function isRecentlyFinishedMatch(match, now = Date.now()) {
  if (!match || match.status !== 'finished') return false;
  const finishedMs = new Date(match.finishedAt ?? 0).getTime();
  if (!Number.isFinite(finishedMs) || finishedMs <= 0) return false;
  return now - finishedMs <= POST_FINISH_GRACE_MS;
}
