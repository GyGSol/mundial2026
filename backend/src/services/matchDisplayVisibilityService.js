import {
  matchFifaTimelineIndicatesFinished,
  maxTimelineMinute,
  minWallClockMsForTimelineMinute,
  resolveKickoffMs,
  wallClockAllowsMatchFinished,
} from './matchStatusRules.js';

/** Ventana en la que un partido finalizado sigue visible en ranking/predicciones. */
export const RECENTLY_FINISHED_GRACE_MS = 30 * 60 * 1000;

/** 90' + descanso + alargue + margen (eliminatorias pueden superar 105'). */
export const MAX_MATCH_DURATION_MS = 150 * 60 * 1000;

/** Máximo de partidos en la barra destacada "recién finalizados" (el más reciente). */
export const RECENT_FINISHED_FEATURED_MAX = 1;

/**
 * Aplica side-effects de transición de status en un payload de persistencia ($set).
 * @param {Record<string, unknown>} update
 * @param {{ previousStatus?: string | null, nextStatus: string, now?: Date, existingFinishedAt?: Date | string | null }} ctx
 */
export function applyStatusTransitionFields(
  update,
  { previousStatus, nextStatus, now = new Date(), existingFinishedAt = null }
) {
  if (nextStatus === 'finished' && previousStatus !== 'finished') {
    const existingMs = existingFinishedAt ? new Date(existingFinishedAt).getTime() : NaN;
    update.finishedAt = Number.isFinite(existingMs) ? new Date(existingMs) : now;
  }
  // No borrar finishedAt al reabrir live: un re-cierre no debe robar "recién finalizado".
  return update;
}

/**
 * Fin efectivo del partido: kickoff + minuto en timeline (no finishedAt de DB, que puede
 * refrescarse al re-finalizar un cierre prematuro).
 */
export function resolveEffectiveFinishedAtMs(match) {
  const kickoffMs = resolveKickoffMs(match);
  if (kickoffMs == null) {
    const finishedMs = match?.finishedAt ? new Date(match.finishedAt).getTime() : NaN;
    return Number.isFinite(finishedMs) ? finishedMs : null;
  }

  const timelineMinute = maxTimelineMinute(match);
  if (timelineMinute != null && matchFifaTimelineIndicatesFinished(match)) {
    const plausibleEndMs = kickoffMs + minWallClockMsForTimelineMinute(timelineMinute);
    const finishedMs = match?.finishedAt ? new Date(match.finishedAt).getTime() : NaN;
    if (
      Number.isFinite(finishedMs) &&
      finishedMs >= plausibleEndMs &&
      finishedMs - plausibleEndMs <= RECENTLY_FINISHED_GRACE_MS * 2
    ) {
      return finishedMs;
    }
    return plausibleEndMs;
  }

  const finishedMs = match?.finishedAt ? new Date(match.finishedAt).getTime() : NaN;
  return Number.isFinite(finishedMs) ? finishedMs : null;
}

/** Query Mongo para partidos finalizados candidatos a gracia (filtrado fino en app). */
export function findRecentlyFinishedMatchesQuery(now = Date.now()) {
  const graceStart = new Date(now - RECENTLY_FINISHED_GRACE_MS);
  const kickoffFloor = new Date(now - RECENTLY_FINISHED_GRACE_MS - MAX_MATCH_DURATION_MS);
  return {
    status: 'finished',
    $or: [
      { finishedAt: { $gte: graceStart } },
      {
        $or: [{ finishedAt: { $exists: false } }, { finishedAt: null }],
        kickoffAt: { $gte: kickoffFloor, $lte: new Date(now) },
      },
    ],
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
  const effectiveFinishedMs = resolveEffectiveFinishedAtMs(match);
  if (effectiveFinishedMs == null || !Number.isFinite(effectiveFinishedMs)) return false;
  if (effectiveFinishedMs > now) return false;
  if (now - effectiveFinishedMs > RECENTLY_FINISHED_GRACE_MS) return false;
  return wallClockAllowsMatchFinished(match, now);
}

export function filterEligibleRecentFinishedMatches(matches, now = Date.now()) {
  return matches.filter((match) => isEligibleRecentFinishedMatch(match, now));
}

/** Solo el/los más recientes para la barra destacada (evita apilar varios finalizados en gracia). */
export function pickFeaturedRecentFinishedMatches(matches, now = Date.now()) {
  return filterEligibleRecentFinishedMatches(matches, now)
    .sort((a, b) => {
      const kickoffDiff =
        new Date(b.kickoffAt ?? 0).getTime() - new Date(a.kickoffAt ?? 0).getTime();
      if (kickoffDiff !== 0) return kickoffDiff;
      const aMs = resolveEffectiveFinishedAtMs(a) ?? 0;
      const bMs = resolveEffectiveFinishedAtMs(b) ?? 0;
      return bMs - aMs;
    })
    .slice(0, RECENT_FINISHED_FEATURED_MAX);
}
