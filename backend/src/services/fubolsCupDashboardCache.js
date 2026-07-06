import { getFubolsCupDashboard } from './fubolsCupService.js';
import { createInMemoryCache } from './inMemoryCache.js';

const LIVE_TTL_MS = 10_000;
const RUNNING_TTL_MS = 15_000;
const DEFAULT_TTL_MS = 30_000;
const COMPLETED_TTL_MS = 60_000;

const cache = createInMemoryCache({ defaultTtlMs: DEFAULT_TTL_MS, maxEntries: 48 });

function dashboardCacheKey(groupId, viewerUserId) {
  const userKey = viewerUserId ? String(viewerUserId) : 'anon';
  return `${groupId}:${userKey}`;
}

function hasLiveWorldCupMatch(payload) {
  return (payload?.rounds ?? []).some((round) =>
    (round.duels ?? []).some((duel) =>
      (duel.worldCupMatches ?? []).some((wc) => wc.match?.status === 'live')
    )
  );
}

export function fubolsCupDashboardCacheTtlMs(payload) {
  const status = payload?.tournament?.status;
  if (status === 'running') {
    return hasLiveWorldCupMatch(payload) ? LIVE_TTL_MS : RUNNING_TTL_MS;
  }
  if (status === 'completed' || status === 'cancelled') return COMPLETED_TTL_MS;
  return DEFAULT_TTL_MS;
}

export function invalidateFubolsCupDashboardCache(groupId) {
  if (groupId === undefined) {
    cache.clear();
    return;
  }
  cache.invalidatePrefix(`${groupId}:`);
}

export async function getCachedFubolsCupDashboard(groupId, viewerUserId) {
  const key = dashboardCacheKey(groupId, viewerUserId);
  return cache.getOrCompute(
    key,
    () => getFubolsCupDashboard(groupId, viewerUserId),
    fubolsCupDashboardCacheTtlMs
  );
}

/** Test helper */
export function clearFubolsCupDashboardCache() {
  cache.clear();
}
