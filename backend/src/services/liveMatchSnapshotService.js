import { Match } from '../models/Match.js';
import {
  enrichMatchesForRankingDashboard,
  prepareFifaShirtMapsForMatches,
} from './matchEnrichmentService.js';
import {
  findRecentlyFinishedMatchesQuery,
  RECENT_FINISHED_FEATURED_MAX,
} from './matchDisplayVisibilityService.js';
import {
  partitionLiveMatchesByActivity,
  buildFeaturedRecentFinishedRaw,
} from './liveMatchPartitionService.js';

const RECENT_FINISHED_QUERY_LIMIT = Math.max(RECENT_FINISHED_FEATURED_MAX + 2, 3);

const BAR_PROJECTION =
  'externalId homeTeamId awayTeamId homeScore awayScore group matchday localDate stadiumId type status finishedAt kickoffAt kickoffTimezone liveStartedPushSentAt weatherOps raw.finished raw.time_elapsed raw.home_scorers raw.away_scorers raw.fifaMeta raw.fifaEvents.timeline raw.fifaEvents.rawEvents';

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

/** Sin TTL: alimenta parches WS en vivo; cachearlo devolvía cronologías atrasadas. */
export async function getCachedLiveMatchSnapshot(userId) {
  return computeLiveMatchSnapshot(userId);
}

/** No-op (cache eliminado); se mantiene para compatibilidad con invalidadores. */
export function invalidateLiveMatchSnapshotCache() {}

/** Test helper */
export function clearLiveMatchSnapshotCache() {}
