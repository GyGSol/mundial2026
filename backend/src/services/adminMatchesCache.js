import { createInMemoryCache } from './inMemoryCache.js';

const CACHE_TTL_MS = 30_000;

const matchesCache = createInMemoryCache({ defaultTtlMs: CACHE_TTL_MS });
const transmissionsCache = createInMemoryCache({ defaultTtlMs: 15_000 });

function matchesCacheKey({ status, group } = {}) {
  return `matches:status=${status || 'all'}:group=${group || 'all'}`;
}

export function invalidateAdminMatchesCache() {
  matchesCache.clear();
  transmissionsCache.clear();
}

export async function getCachedAdminMatches(filters = {}) {
  const key = matchesCacheKey(filters);
  return matchesCache.getOrCompute(
    key,
    async () => {
      const { listAdminMatches } = await import('./adminService.js');
      return listAdminMatches(filters);
    },
    CACHE_TTL_MS
  );
}

export async function getCachedAdminTodayTransmissions(compute) {
  return transmissionsCache.getOrCompute('today', compute, 15_000);
}

/** Test helper */
export function clearAdminMatchesCache() {
  matchesCache.clear();
  transmissionsCache.clear();
}
