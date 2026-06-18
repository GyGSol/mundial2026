import { getLeaderboard } from './leaderboardService.js';
import { createInMemoryCache } from './inMemoryCache.js';

const DEFAULT_TTL_MS = 30_000;
const LIVE_TTL_MS = 10_000;

const cache = createInMemoryCache({ defaultTtlMs: DEFAULT_TTL_MS });

function leaderboardCacheKey(competitionGroupId, limit, options = {}) {
  const groupKey = competitionGroupId ?? 'global';
  const exclude = [...(options.excludeMatchIds ?? [])].sort().join(',');
  const liveBaseline = [...(options.liveKickoffBaselineMatchIds ?? [])].sort().join(',');
  return `${groupKey}:${limit}:ex=${exclude}:lb=${liveBaseline}`;
}

export function invalidateLeaderboardCache(groupId) {
  if (groupId === undefined) {
    cache.clear();
    return;
  }
  const prefix = `${groupId}:`;
  cache.invalidatePrefix(prefix);
  if (groupId === null) {
    cache.invalidatePrefix('global:');
  }
}

export async function getCachedLeaderboard(
  competitionGroupId,
  limit = 100,
  options = {},
  { hasLiveMatches = false } = {}
) {
  const key = leaderboardCacheKey(competitionGroupId, limit, options);
  const ttlMs = hasLiveMatches ? LIVE_TTL_MS : DEFAULT_TTL_MS;
  return cache.getOrCompute(key, () => getLeaderboard(competitionGroupId, limit, options), ttlMs);
}

/** Test helper */
export function clearLeaderboardCache() {
  cache.clear();
}
