import { createInMemoryCache } from './inMemoryCache.js';
import { getLeaderboardPointsEvolution } from './leaderboardPointsEvolutionService.js';

const STABLE_TTL_MS = 60_000;
const LIVE_TTL_MS = 2_500;

const cache = createInMemoryCache({ defaultTtlMs: STABLE_TTL_MS });

export function pointsEvolutionCacheTtlMs(payload) {
  if (payload?.hasLiveMatches) return LIVE_TTL_MS;
  return STABLE_TTL_MS;
}

export function invalidateLeaderboardPointsEvolutionCache(groupId) {
  if (groupId === undefined) {
    cache.clear();
    return;
  }
  cache.invalidatePrefix(`${groupId}:`);
}

export async function getCachedLeaderboardPointsEvolution(groupId) {
  const key = `${groupId}:evolution`;
  return cache.getOrCompute(
    key,
    () => getLeaderboardPointsEvolution(groupId),
    pointsEvolutionCacheTtlMs
  );
}

/** Test helper */
export function clearLeaderboardPointsEvolutionCache() {
  cache.clear();
}
