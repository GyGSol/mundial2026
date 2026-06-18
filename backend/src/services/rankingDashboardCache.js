import { getRankingDashboard } from './rankingDashboardService.js';
import { createInMemoryCache } from './inMemoryCache.js';

const DEFAULT_TTL_MS = 15_000;
const LIVE_TTL_MS = 2_500;
const RECENT_FINISHED_TTL_MS = 10_000;

const cache = createInMemoryCache({ defaultTtlMs: DEFAULT_TTL_MS });

function dashboardCacheKey(groupId, userId) {
  const userKey = userId ? String(userId) : 'anon';
  return `${groupId}:${userKey}`;
}

export function dashboardCacheTtlMs(payload) {
  if ((payload?.liveMatches?.length ?? 0) > 0) return LIVE_TTL_MS;
  if ((payload?.recentFinishedMatches?.length ?? 0) > 0) return RECENT_FINISHED_TTL_MS;
  return DEFAULT_TTL_MS;
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
  return cache.getOrCompute(
    key,
    () => getRankingDashboard(groupId, userId),
    dashboardCacheTtlMs
  );
}

/** Test helper */
export function clearRankingDashboardCache() {
  cache.clear();
}
