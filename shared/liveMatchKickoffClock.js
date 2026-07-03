/**
 * Estima el minuto de juego desde kickoffAt cuando FIFA/worldcup26 no publican reloj.
 * Solo fallback: no reemplaza un reloj fiable más avanzado.
 */

const HALFTIME_BREAK_MS = 15 * 60 * 1000;
const MAX_REGULAR_ESTIMATE_MIN = 95;

/**
 * @param {Date | string | number | null | undefined} kickoffAt
 * @param {number} [now]
 */
export function estimateLiveClockFromKickoff(kickoffAt, now = Date.now()) {
  if (!kickoffAt) return null;
  const kickoffMs = new Date(kickoffAt).getTime();
  if (!Number.isFinite(kickoffMs) || kickoffMs > now) return null;

  const elapsedMs = now - kickoffMs;
  let minute = Math.floor(elapsedMs / 60_000);

  // Aproximar entretiempo (~15') una vez pasados 45' de reloj de pared.
  if (minute > 45 && minute < 60) {
    minute = Math.max(45, minute - Math.floor(HALFTIME_BREAK_MS / 60_000));
  }

  minute = Math.min(minute, MAX_REGULAR_ESTIMATE_MIN);
  if (minute < 1) return "1'";
  return `${minute}'`;
}

/**
 * Solo usar kickoff cuando FIFA/cronología no publican reloj (0', live, null).
 * Nunca reemplazar un reloj fiable aunque kickoffAt esté desfasado (demora pre-inicio).
 *
 * @param {string | null | undefined} clockLabel
 */
export function kickoffClockShouldOverride(clockLabel, kickoffClock) {
  if (!kickoffClock) return false;
  const kickoffKey = parseKickoffClockSortKey(kickoffClock);
  if (kickoffKey < 1) return false;

  const bestKey = parseKickoffClockSortKey(clockLabel);
  return bestKey < 1;
}

function parseKickoffClockSortKey(clock) {
  if (clock == null) return Number.NEGATIVE_INFINITY;
  const normalized = String(clock).trim().replace(/'+$/, '').toLowerCase();
  if (!normalized || normalized === '0') return Number.NEGATIVE_INFINITY;

  const extraMatch = normalized.match(/^(\d+)\+(\d+)$/);
  if (extraMatch) return Number(extraMatch[1]) + Number(extraMatch[2]) / 100;

  const minute = Number(normalized);
  return Number.isFinite(minute) ? minute : Number.NEGATIVE_INFINITY;
}
