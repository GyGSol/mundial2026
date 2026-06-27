import { getRankingDashboard, getRankingDashboardShell } from './rankingDashboardService.js';
import { createInMemoryCache } from './inMemoryCache.js';
import { invalidateRankingDashboardShellCache } from './rankingDashboardShellCache.js';
import { invalidateLiveFeaturedBarCache } from './liveFeaturedBarCache.js';

const DEFAULT_TTL_MS = 15_000;
const LIVE_TTL_MS = 10_000;
/** Mismo TTL que en vivo: el marcador puede cambiar hasta el reporte FIFA final. */
const RECENT_FINISHED_TTL_MS = LIVE_TTL_MS;

const cache = createInMemoryCache({ defaultTtlMs: DEFAULT_TTL_MS, maxEntries: 48 });

function dashboardCacheKey(groupId, userId, detailMatchId) {
  const userKey = userId ? String(userId) : 'anon';
  const detailKey = detailMatchId ? String(detailMatchId) : 'auto';
  return `${groupId}:${userKey}:${detailKey}`;
}

export function dashboardCacheTtlMs(payload) {
  if ((payload?.liveMatches?.length ?? 0) > 0) return LIVE_TTL_MS;
  if ((payload?.recentFinishedMatches?.length ?? 0) > 0) return RECENT_FINISHED_TTL_MS;
  return DEFAULT_TTL_MS;
}

export function invalidateRankingDashboardCache(groupId) {
  if (groupId === undefined) {
    cache.clear();
    invalidateRankingDashboardShellCache();
    invalidateLiveFeaturedBarCache();
    return;
  }
  cache.invalidatePrefix(`${groupId}:`);
  invalidateRankingDashboardShellCache(groupId);
}

export async function getCachedRankingDashboardShellOnly(groupId, userId) {
  return getRankingDashboardShell(groupId, userId);
}

export async function getCachedRankingDashboard(groupId, userId, detailMatchId) {
  const key = dashboardCacheKey(groupId, userId, detailMatchId);
  return cache.getOrCompute(
    key,
    () => getRankingDashboard(groupId, userId, detailMatchId),
    dashboardCacheTtlMs
  );
}

/** Test helper */
export function clearRankingDashboardCache() {
  cache.clear();
}
