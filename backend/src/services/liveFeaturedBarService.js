import {
  enrichMatchesForRankingDashboard,
  enrichMatchesForLiveBarSummary,
  prepareFifaShirtMapsForMatches,
} from './matchEnrichmentService.js';
import { buildMatchLineupPayload } from './matchLineupService.js';
import { sortLiveMatchesForFeaturedBar } from './liveMatchPartitionService.js';

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

  const [detailEnriched, summaryEnriched, recentEnriched] = await Promise.all([
    detailLiveRaw.length
      ? enrichMatchesForRankingDashboard(detailLiveRaw, userId)
      : Promise.resolve([]),
    summaryLiveRaw.length
      ? enrichMatchesForLiveBarSummary(summaryLiveRaw, userId)
      : Promise.resolve([]),
    recentFeaturedRaw.length
      ? enrichMatchesForRankingDashboard(recentFeaturedRaw, userId)
      : Promise.resolve([]),
  ]);

  const enrichedById = new Map(
    [...detailEnriched, ...summaryEnriched, ...recentEnriched].map((m) => [m.id, m])
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
      featured.lineup = await buildMatchLineupPayload(raw, { fetchExternalShirts: true });
    }),
    ...(attachRecentLineups
      ? recentFinishedMatches.map(async (featured) => {
          const raw = recentRawById.get(featured.id);
          if (!raw) return;
          featured.lineup = await buildMatchLineupPayload(raw, { fetchExternalShirts: true });
        })
      : []),
  ]);

  return { liveMatches, recentFinishedMatches, detailMatchId: resolvedDetailId };
}
