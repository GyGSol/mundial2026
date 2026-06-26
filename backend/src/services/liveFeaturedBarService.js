import {
  enrichMatchesForRankingDashboard,
  enrichMatchesForLiveBarSummary,
  prepareFifaShirtMapsForMatches,
} from './matchEnrichmentService.js';
import { buildMatchLineupPayload } from './matchLineupService.js';
import { sortLiveMatchesForFeaturedBar } from './liveMatchPartitionService.js';
import { createInMemoryCache } from './inMemoryCache.js';
import { matchEnrichmentRevision } from './matchEnrichmentRevision.js';

const MATCH_ENRICHMENT_TTL_MS = 10_000;
const matchEnrichmentCache = createInMemoryCache({
  defaultTtlMs: MATCH_ENRICHMENT_TTL_MS,
  maxEntries: 32,
});

function matchEnrichmentCacheKey(raw, userId, tier) {
  const userKey = userId ? String(userId) : 'anon';
  return `${raw._id}:${userKey}:${tier}:${matchEnrichmentRevision(raw)}`;
}

async function enrichSingleMatchCached(raw, userId, tier) {
  const key = matchEnrichmentCacheKey(raw, userId, tier);
  return matchEnrichmentCache.getOrCompute(
    key,
    async () => {
      const enricher =
        tier === 'full' ? enrichMatchesForRankingDashboard : enrichMatchesForLiveBarSummary;
      const [match] = await enricher([raw], userId);
      return match ?? null;
    },
    MATCH_ENRICHMENT_TTL_MS
  );
}

/** Test helper */
export function clearLiveFeaturedBarMatchEnrichmentCache() {
  matchEnrichmentCache.clear();
}

/**
 * @param {import('mongoose').LeanDocument[]} activeLiveRaw
 * @param {import('mongoose').LeanDocument[]} recentFeaturedRaw
 * @param {import('mongoose').Types.ObjectId | undefined} userId
 * @param {string | null | undefined} detailMatchId
 * @param {{ attachRecentLineups?: boolean }} [options]
 */
export async function enrichFeaturedBarPayload({
  activeLiveRaw,
  recentFeaturedRaw,
  userId,
  detailMatchId,
  attachRecentLineups = true,
}) {
  if (!activeLiveRaw.length && !recentFeaturedRaw.length) {
    return { liveMatches: [], recentFinishedMatches: [], detailMatchId: null };
  }

  const resolvedDetailId =
    detailMatchId && activeLiveRaw.some((m) => m._id.toString() === detailMatchId)
      ? detailMatchId
      : activeLiveRaw[0]?._id?.toString() ?? null;

  const detailLiveRaw = resolvedDetailId
    ? activeLiveRaw.filter((m) => m._id.toString() === resolvedDetailId)
    : [];
  const summaryLiveRaw = resolvedDetailId
    ? activeLiveRaw.filter((m) => m._id.toString() !== resolvedDetailId)
    : activeLiveRaw;

  await prepareFifaShirtMapsForMatches([...activeLiveRaw, ...recentFeaturedRaw]);

  const [detailEnriched, summaryEnrichedList, recentEnrichedList] = await Promise.all([
    detailLiveRaw.length
      ? enrichSingleMatchCached(detailLiveRaw[0], userId, 'full')
      : Promise.resolve(null),
    summaryLiveRaw.length
      ? Promise.all(summaryLiveRaw.map((raw) => enrichSingleMatchCached(raw, userId, 'summary')))
      : Promise.resolve([]),
    recentFeaturedRaw.length
      ? Promise.all(
          recentFeaturedRaw.map((raw) => enrichSingleMatchCached(raw, userId, 'full'))
        )
      : Promise.resolve([]),
  ]);

  const enrichedById = new Map(
    [
      detailEnriched,
      ...summaryEnrichedList.filter(Boolean),
      ...recentEnrichedList.filter(Boolean),
    ]
      .filter(Boolean)
      .map((m) => [m.id, m])
  );

  const liveMatches = sortLiveMatchesForFeaturedBar(
    activeLiveRaw.map((m) => enrichedById.get(m._id.toString())).filter(Boolean)
  );
  const recentFinishedMatches = recentFeaturedRaw
    .map((m) => enrichedById.get(m._id.toString()))
    .filter(Boolean);

  const liveRawById = new Map(activeLiveRaw.map((m) => [m._id.toString(), m]));
  const recentRawById = new Map(recentFeaturedRaw.map((m) => [m._id.toString(), m]));

  await Promise.all([
    ...liveMatches.map(async (featured) => {
      if (featured.id !== resolvedDetailId) return;
      const raw = liveRawById.get(featured.id);
      if (!raw) return;
      featured.lineup = await buildMatchLineupPayload(raw, { fetchExternalShirts: false });
    }),
    ...(attachRecentLineups
      ? recentFinishedMatches.map(async (featured) => {
          const raw = recentRawById.get(featured.id);
          if (!raw) return;
          featured.lineup = await buildMatchLineupPayload(raw, { fetchExternalShirts: false });
        })
      : []),
  ]);

  return { liveMatches, recentFinishedMatches, detailMatchId: resolvedDetailId };
}
