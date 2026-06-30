import { Match } from '../models/Match.js';
import {
  findRecentlyFinishedMatchesQuery,
  RECENT_FINISHED_FEATURED_MAX,
} from './matchDisplayVisibilityService.js';
import {
  partitionLiveMatchesByActivity,
  buildFeaturedRecentFinishedRaw,
} from './liveMatchPartitionService.js';
import { enrichFeaturedBarPayload } from './liveFeaturedBarService.js';
import { LIVE_BAR_MATCH_PROJECTION } from './liveBarMatchProjection.js';

const RECENT_FINISHED_QUERY_LIMIT = Math.max(RECENT_FINISHED_FEATURED_MAX + 2, 3);

async function computeLiveMatchSnapshot(userId, detailMatchId) {
  const [liveRaw, recentFinishedRaw] = await Promise.all([
    Match.find({ status: 'live' })
      .select(LIVE_BAR_MATCH_PROJECTION)
      .sort({ kickoffAt: 1, externalId: 1 })
      .lean(),
    Match.find(findRecentlyFinishedMatchesQuery())
      .select(LIVE_BAR_MATCH_PROJECTION)
      .sort({ finishedAt: -1, kickoffAt: -1 })
      .limit(RECENT_FINISHED_QUERY_LIMIT)
      .lean(),
  ]);

  const { activeLiveRaw, staleLiveRaw } = partitionLiveMatchesByActivity(liveRaw);
  const recentFeaturedRaw = buildFeaturedRecentFinishedRaw(recentFinishedRaw, staleLiveRaw, Date.now(), {
    activeLiveRaw,
  });

  return enrichFeaturedBarPayload({
    activeLiveRaw,
    recentFeaturedRaw,
    userId,
    detailMatchId,
  });
}

/** Sin TTL: alimenta parches WS en vivo; cachearlo devolvía cronologías atrasadas. */
export async function getCachedLiveMatchSnapshot(userId, detailMatchId) {
  return computeLiveMatchSnapshot(userId, detailMatchId);
}

/** No-op (cache eliminado); se mantiene para compatibilidad con invalidadores. */
export function invalidateLiveMatchSnapshotCache() {}

/** Test helper */
export function clearLiveMatchSnapshotCache() {}
