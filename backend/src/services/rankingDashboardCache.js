import { getRankingDashboard } from './rankingDashboardService.js';
import { createInMemoryCache } from './inMemoryCache.js';

const DEFAULT_TTL_MS = 15_000;
const LIVE_OR_RECENT_FINISHED_TTL_MS = 5_000;
const RECENT_FINISHED_WINDOW_MS = 4 * 60 * 60 * 1000;

const cache = createInMemoryCache({ defaultTtlMs: DEFAULT_TTL_MS });

function dashboardCacheKey(groupId, userId) {
  const userKey = userId ? String(userId) : 'anon';
  return `${groupId}:${userKey}`;
}

function hasRecentlyFinishedMatch(payload, now = Date.now()) {
  const cutoff = now - RECENT_FINISHED_WINDOW_MS;
  return (payload?.recentFinishedMatches ?? []).some((match) => {
    const kickoffMs = new Date(match.kickoffAt || 0).getTime();
    return Number.isFinite(kickoffMs) && kickoffMs >= cutoff;
  });
}

export function dashboardCacheTtlMs(payload) {
  if ((payload?.liveMatches?.length ?? 0) > 0) return LIVE_OR_RECENT_FINISHED_TTL_MS;
  if (hasRecentlyFinishedMatch(payload)) return LIVE_OR_RECENT_FINISHED_TTL_MS;
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
