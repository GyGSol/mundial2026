import { createInMemoryCache } from './inMemoryCache.js';
import { resolveLiveSyncCadence } from './liveSyncCadenceService.js';

const DEFAULT_TTL_MS = 15_000;
const LIVE_TTL_MS = 10_000;

const cache = createInMemoryCache({ defaultTtlMs: DEFAULT_TTL_MS, maxEntries: 48 });

function shellCacheKey(groupId, userId, inputsSignature) {
  const userKey = userId ? String(userId) : 'anon';
  return `shell:${groupId}:${userKey}:${inputsSignature}`;
}

export function rankingShellCacheTtlMs({ hasLiveOrRecent = false, activeLiveCount = 0 } = {}) {
  if (!hasLiveOrRecent) return DEFAULT_TTL_MS;
  if (activeLiveCount > 0) {
    return resolveLiveSyncCadence(activeLiveCount).dashboardCacheLiveTtlMs;
  }
  return LIVE_TTL_MS;
}

export async function getCachedRankingDashboardShell(
  groupId,
  userId,
  inputsSignature,
  compute,
  { hasLiveOrRecent = false, activeLiveCount = 0 } = {}
) {
  const key = shellCacheKey(groupId, userId, inputsSignature);
  return cache.getOrCompute(
    key,
    compute,
    () => rankingShellCacheTtlMs({ hasLiveOrRecent, activeLiveCount })
  );
}

export function invalidateRankingDashboardShellCache(groupId) {
  if (groupId === undefined) {
    cache.clear();
    return;
  }
  cache.invalidatePrefix(`shell:${groupId}:`);
}

/** Test helper */
export function clearRankingDashboardShellCache() {
  cache.clear();
}
