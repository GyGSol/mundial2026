import { wallClockAllowsMatchFinished } from './matchStatusRules.js';

/** Ventana en la que un partido finalizado sigue visible en ranking/predicciones. */
export const RECENTLY_FINISHED_GRACE_MS = 30 * 60 * 1000;

/**
 * Aplica side-effects de transición de status en un payload de persistencia ($set).
 * @param {Record<string, unknown>} update
 * @param {{ previousStatus?: string | null, nextStatus: string, now?: Date }} ctx
 */
export function applyStatusTransitionFields(update, { previousStatus, nextStatus, now = new Date() }) {
  if (nextStatus === 'finished' && previousStatus !== 'finished') {
    update.finishedAt = now;
  }
  if (nextStatus === 'live' && previousStatus === 'finished') {
    update.finishedAt = null;
  }
  return update;
}

/** Query Mongo para partidos finalizados dentro de la ventana de gracia. */
export function findRecentlyFinishedMatchesQuery(now = Date.now()) {
  const cutoff = new Date(now - RECENTLY_FINISHED_GRACE_MS);
  return {
    status: 'finished',
    finishedAt: { $gte: cutoff },
    kickoffAt: { $lte: new Date(now) },
  };
}

/** Filtro opcional por grupo (predicciones). */
export function findRecentlyFinishedMatchesQueryWithGroup(group, now = Date.now()) {
  const query = findRecentlyFinishedMatchesQuery(now);
  if (group) query.group = String(group).trim();
  return query;
}

export function findLiveMatchesQueryWithGroup(group) {
  const query = { status: 'live' };
  if (group) query.group = String(group).trim();
  return query;
}

/** Partidos finished recientes elegibles para la barra (gracia + reloj de pared creíble). */
export function isEligibleRecentFinishedMatch(match, now = Date.now()) {
  if (match?.status !== 'finished') return false;
  if (!match.finishedAt) return false;
  const finishedMs = new Date(match.finishedAt).getTime();
  if (!Number.isFinite(finishedMs) || now - finishedMs > RECENTLY_FINISHED_GRACE_MS) return false;
  return wallClockAllowsMatchFinished(match, now);
}

export function filterEligibleRecentFinishedMatches(matches, now = Date.now()) {
  return matches.filter((match) => isEligibleRecentFinishedMatch(match, now));
}
