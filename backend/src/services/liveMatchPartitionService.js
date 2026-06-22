import { isMatchActivelyLive } from './matchStatusRules.js';
import { pickFeaturedRecentFinishedMatches } from './matchDisplayVisibilityService.js';
import { compareMatchesBySchedule, compareMatchesByScheduleDesc } from './matchSortService.js';
import { normalizeWeatherOps } from './matchWeatherOpsRules.js';
import { isMatchPlayPaused, resolveMatchPlayState } from './matchPlayStateService.js';

/** Separa partidos `live` en juego vs zombies pendientes de pasar a `finished`. */
export function partitionLiveMatchesByActivity(liveRaw = [], now = Date.now()) {
  const activeLiveRaw = [];
  const staleLiveRaw = [];
  for (const match of liveRaw) {
    if (isMatchActivelyLive(match, now)) activeLiveRaw.push(match);
    else staleLiveRaw.push(match);
  }
  return { activeLiveRaw, staleLiveRaw };
}

/**
 * Prioridad en la barra "Partidos en curso":
 * 0 = jugando activamente, 1 = pausado/suspendido por clima u otro estado, 2 = resto.
 */
export function liveMatchFeaturedSortTier(match) {
  if (match?.status !== 'live') return 2;

  const weatherPhase = normalizeWeatherOps(match.weatherOps).phase;
  if (weatherPhase === 'suspended' || weatherPhase === 'pre_kickoff_delay' || weatherPhase === 'postponed') {
    return 1;
  }

  const playState = match.matchPlayState ?? resolveMatchPlayState(match);
  if (isMatchPlayPaused(playState)) return 1;

  return 0;
}

/** Activo arriba; pausado/suspendido abajo (misma lista en curso). */
export function compareLiveMatchesForFeaturedBar(matchA, matchB) {
  const tierA = liveMatchFeaturedSortTier(matchA);
  const tierB = liveMatchFeaturedSortTier(matchB);
  if (tierA !== tierB) return tierA - tierB;
  if (tierA === 0) return compareMatchesByScheduleDesc(matchA, matchB);
  return compareMatchesBySchedule(matchA, matchB);
}

export function sortLiveMatchesForFeaturedBar(matches = []) {
  return [...matches].sort(compareLiveMatchesForFeaturedBar);
}

/** Recién finalizados de DB + live-zombies para la barra destacada. */
export function buildFeaturedRecentFinishedRaw(recentFinishedRaw = [], staleLiveRaw = [], now = Date.now()) {
  const featuredFinished = pickFeaturedRecentFinishedMatches(recentFinishedRaw, now);
  const seen = new Set(featuredFinished.map((m) => m._id?.toString() ?? m.id));
  const staleUnique = staleLiveRaw.filter((m) => {
    const id = m._id?.toString() ?? m.id;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  return [...featuredFinished, ...staleUnique];
}
