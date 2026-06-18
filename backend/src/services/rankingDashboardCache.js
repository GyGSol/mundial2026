import { getRankingDashboard } from './rankingDashboardService.js';
import { createInMemoryCache } from './inMemoryCache.js';

const CACHE_TTL_MS = 15_000;

const cache = createInMemoryCache({ defaultTtlMs: CACHE_TTL_MS });

function dashboardCacheKey(groupId, userId) {
  const userKey = userId ? String(userId) : 'anon';
  return `${groupId}:${userKey}`;
}

export function invalidateRankingDashboardCache(groupId) {
  if (groupId === undefined) {
    cache.clear();
    return;
  }
  cache.invalidatePrefix(`${groupId}:`);
}

export async function getCachedRankingDashboard(groupId, userId) {
  const key = dashboardCacheKey(groupId, userId);
  return cache.getOrCompute(key, () => getRankingDashboard(groupId, userId), CACHE_TTL_MS);
}

/** Test helper */
export function clearRankingDashboardCache() {
  cache.clear();
}
