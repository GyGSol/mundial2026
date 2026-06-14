import { Match } from '../models/Match.js';
import { Team } from '../models/Team.js';
import { Group } from '../models/Group.js';
import { Stadium } from '../models/Stadium.js';
import { getLastSyncAt } from './syncService.js';
import { buildWorldCupOverview } from './worldCupStatsService.js';

const CACHE_TTL_MS = 30_000;

/** @type {Map<string, { expiresAt: number, value?: object, promise?: Promise<object> }>} */
const cacheByKey = new Map();

function cacheKey(includePlayerStats) {
  return includePlayerStats ? 'with-player-stats' : 'base';
}

export function invalidateWorldCupOverviewCache() {
  cacheByKey.clear();
}

export async function getCachedWorldCupOverview({ includePlayerStats = false } = {}) {
  const key = cacheKey(includePlayerStats);
  const now = Date.now();
  const entry = cacheByKey.get(key);

  if (entry?.value && entry.expiresAt > now) {
    return entry.value;
  }

  if (entry?.promise) {
    return entry.promise;
  }

  const promise = buildWorldCupOverview({
    Match,
    Team,
    Group,
    Stadium,
    getLastSyncAt,
    includePlayerStats,
  }).then((value) => {
    cacheByKey.set(key, {
      value,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return value;
  });

  cacheByKey.set(key, {
    expiresAt: now + CACHE_TTL_MS,
    promise,
  });

  return promise;
}

/** Test helper */
export function clearWorldCupOverviewCache() {
  cacheByKey.clear();
}
