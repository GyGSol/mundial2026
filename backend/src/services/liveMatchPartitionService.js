import { isMatchActivelyLive } from './matchStatusRules.js';
import { pickFeaturedRecentFinishedMatches } from './matchDisplayVisibilityService.js';

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
