import { Match } from '../models/Match.js';
import {
  enrichMatchesForRankingDashboard,
  prepareFifaShirtMapsForMatches,
} from './matchEnrichmentService.js';
import { createInMemoryCache } from './inMemoryCache.js';
import {
  findRecentlyFinishedMatchesQuery,
  RECENT_FINISHED_FEATURED_MAX,
} from './matchDisplayVisibilityService.js';
import {
  partitionLiveMatchesByActivity,
  buildFeaturedRecentFinishedRaw,
} from './liveMatchPartitionService.js';

const LIVE_TTL_MS = 2_500;
const cache = createInMemoryCache({ defaultTtlMs: LIVE_TTL_MS });

const RECENT_FINISHED_QUERY_LIMIT = Math.max(RECENT_FINISHED_FEATURED_MAX + 2, 3);

const BAR_PROJECTION =
  'externalId homeTeamId awayTeamId homeScore awayScore group matchday localDate stadiumId type status finishedAt kickoffAt kickoffTimezone liveStartedPushSentAt weatherOps raw.finished raw.time_elapsed raw.fifaEvents.timeline';

async function computeLiveMatchSnapshot(userId) {
  const [liveRaw, recentFinishedRaw] = await Promise.all([
    Match.find({ status: 'live' })
      .select(BAR_PROJECTION)
      .sort({ kickoffAt: 1, externalId: 1 })
      .lean(),
    Match.find(findRecentlyFinishedMatchesQuery())
      .select(BAR_PROJECTION)
      .sort({ finishedAt: -1, kickoffAt: -1 })
      .limit(RECENT_FINISHED_QUERY_LIMIT)
      .lean(),
  ]);

  const { activeLiveRaw, staleLiveRaw } = partitionLiveMatchesByActivity(liveRaw);
  const recentFeaturedRaw = buildFeaturedRecentFinishedRaw(recentFinishedRaw, staleLiveRaw);
  const barMatches = [...activeLiveRaw, ...recentFeaturedRaw];

  if (!barMatches.length) {
    return { liveMatches: [], recentFinishedMatches: [] };
  }

  await prepareFifaShirtMapsForMatches(barMatches);
  const enriched = await enrichMatchesForRankingDashboard(barMatches, userId);
  const byMongoId = new Map(enriched.map((m) => [m.id, m]));

  const liveMatches = activeLiveRaw
    .map((m) => byMongoId.get(m._id.toString()))
    .filter(Boolean);
  const recentFinishedMatches = recentFeaturedRaw
    .map((m) => byMongoId.get(m._id.toString()))
    .filter(Boolean);

  return { liveMatches, recentFinishedMatches };
}

export async function getCachedLiveMatchSnapshot(userId) {
  const key = userId ? `user:${userId}` : 'anon';
  return cache.getOrCompute(key, () => computeLiveMatchSnapshot(userId), LIVE_TTL_MS);
}

export function invalidateLiveMatchSnapshotCache() {
  cache.clear();
}

/** Test helper */
export function clearLiveMatchSnapshotCache() {
  cache.clear();
}
