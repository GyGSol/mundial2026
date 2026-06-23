import { Match } from '../models/Match.js';
import { getCachedLeaderboard } from './leaderboardCache.js';
import { getLiveMatchStatIndicatorsByUser } from './leaderboardService.js';
import { getLastSyncAt } from './syncService.js';
import { getCompetitionGroupById } from './competitionGroupService.js';
import {
  enrichMatchesForRankingDashboard,
  enrichMatchesForRankingUpcoming,
  prepareFifaShirtMapsForMatches,
} from './matchEnrichmentService.js';
import { attachStreamMetaToMatches } from './streamMetaService.js';
import { compareMatchesBySchedule } from './matchSortService.js';
import {
  projectPrizeDistribution,
  attachProjectedFubolsToLeaderboard,
} from './prizePoolService.js';
import { ensureAiCompetitorInGroup } from './aiGroupMembershipService.js';
import { getGroupEntryFeeStats, syncMemberEntryFees } from './fubolService.js';
import {
  findRecentlyFinishedMatchesQuery,
  RECENT_FINISHED_FEATURED_MAX,
} from './matchDisplayVisibilityService.js';
import { getCachedRankingFinishedMatches } from './rankingFinishedMatchesCache.js';
import { buildMatchLineupPayload } from './matchLineupService.js';
import {
  partitionLiveMatchesByActivity,
  buildFeaturedRecentFinishedRaw,
  sortLiveMatchesForFeaturedBar,
} from './liveMatchPartitionService.js';

const UPCOMING_MATCH_LIMIT = 30;
/** Solo hace falta enriquecer candidatos a la barra destacada (máx. 1 visible). */
const RECENT_FINISHED_QUERY_LIMIT = Math.max(RECENT_FINISHED_FEATURED_MAX + 2, 3);

export { FINISHED_ARCHIVE_LIMIT } from './rankingFinishedMatchesCache.js';

function kickoffKey(kickoffAt) {
  if (!kickoffAt) return '';
  const ms = new Date(kickoffAt).getTime();
  return Number.isNaN(ms) ? String(kickoffAt) : String(ms);
}

/** Partidos en vivo excluidos del baseline de flechas PA/GL/GV/GT (soporta varios simultáneos). */
export function liveMatchIdsForStatIndicators(liveMatchIds) {
  return [...new Set(liveMatchIds)];
}

function findNextUpcomingMatches(matches) {
  const upcoming = [...matches]
    .filter((m) => m.status === 'upcoming' && (m.scheduleKickoffAt || m.kickoffAt))
    .sort(compareMatchesBySchedule);
  if (!upcoming.length) return [];
  const slot = kickoffKey(upcoming[0].scheduleKickoffAt ?? upcoming[0].kickoffAt);
  return upcoming.filter((m) => kickoffKey(m.scheduleKickoffAt ?? m.kickoffAt) === slot);
}

async function resolveGroup(groupId) {
  if (!groupId) {
    return { group: null };
  }
  if (groupId === '__nogroup') {
    return { group: { id: '__nogroup', name: 'Sin grupo' } };
  }
  const group = await getCompetitionGroupById(groupId);
  if (!group) {
    return { group: null, notFound: true };
  }
  return { group };
}

export async function getRankingDashboard(groupId, userId) {
  const groupResult = await resolveGroup(groupId);
  if (groupResult.notFound) {
    return { notFound: true };
  }

  const [lastSyncAt, liveRaw, upcomingRaw, recentFinishedRaw] = await Promise.all([
    getLastSyncAt(),
    Match.find({ status: 'live' }).sort({ kickoffAt: 1, externalId: 1 }).lean(),
    Match.find({ status: 'upcoming' })
      .sort({ kickoffAt: 1 })
      .limit(UPCOMING_MATCH_LIMIT)
      .lean(),
    Match.find(findRecentlyFinishedMatchesQuery())
      .sort({ finishedAt: -1, kickoffAt: -1 })
      .limit(RECENT_FINISHED_QUERY_LIMIT)
      .lean(),
  ]);

  const { activeLiveRaw, staleLiveRaw } = partitionLiveMatchesByActivity(liveRaw);
  const recentFeaturedRaw = buildFeaturedRecentFinishedRaw(recentFinishedRaw, staleLiveRaw);

  const matchesToEnrichFeatured = [...activeLiveRaw, ...recentFeaturedRaw];
  const nextSlotRaw = findNextUpcomingMatches(upcomingRaw);
  await prepareFifaShirtMapsForMatches([...matchesToEnrichFeatured, ...nextSlotRaw]);
  const [enrichedFeatured, enrichedUpcoming] = await Promise.all([
    enrichMatchesForRankingDashboard(matchesToEnrichFeatured, userId),
    enrichMatchesForRankingUpcoming(nextSlotRaw, userId),
  ]);
  const byId = new Map(
    [...enrichedFeatured, ...enrichedUpcoming].map((m) => [m.id, m])
  );

  const liveMatches = sortLiveMatchesForFeaturedBar(
    activeLiveRaw.map((m) => byId.get(m._id.toString())).filter(Boolean)
  );
  const recentFinishedMatches = recentFeaturedRaw
    .map((m) => byId.get(m._id.toString()))
    .filter(Boolean);

  if (groupId && groupId !== '__nogroup') {
    await ensureAiCompetitorInGroup(groupId);
  }

  const liveMatchIds = liveMatches.map((match) => match.id);
  const indicatorBaselineMatchIds = liveMatchIdsForStatIndicators(liveMatchIds);
  const hasLive = indicatorBaselineMatchIds.length > 0;
  const leaderboard = await getCachedLeaderboard(groupId || null, 100, {}, {
    hasLiveMatches: hasLive,
  });
  const [leaderboardKickoffBaseline, leaderboardLiveStatIndicators] = await Promise.all([
    hasLive
      ? getCachedLeaderboard(
          groupId || null,
          100,
          { liveKickoffBaselineMatchIds: indicatorBaselineMatchIds },
          { hasLiveMatches: true }
        )
      : Promise.resolve(null),
    hasLive
      ? getLiveMatchStatIndicatorsByUser(
          leaderboard.map((row) => row.id),
          liveMatchIds
        )
      : Promise.resolve(null),
  ]);

  const nextUpcomingMatches = findNextUpcomingMatches(
    enrichedUpcoming
  );

  const liveRawById = new Map(activeLiveRaw.map((m) => [m._id.toString(), m]));
  const upcomingRawById = new Map(upcomingRaw.map((m) => [m._id.toString(), m]));
  const recentRawById = new Map(recentFeaturedRaw.map((m) => [m._id.toString(), m]));
  await Promise.all([
    ...liveMatches.map(async (featured) => {
      const raw = liveRawById.get(featured.id);
      if (!raw) return;
      featured.lineup = await buildMatchLineupPayload(raw, { fetchExternalShirts: true });
    }),
    ...recentFinishedMatches.map(async (featured) => {
      const raw = recentRawById.get(featured.id);
      if (!raw) return;
      featured.lineup = await buildMatchLineupPayload(raw, { fetchExternalShirts: true });
    }),
    ...nextUpcomingMatches.map(async (featured) => {
      const raw = upcomingRawById.get(featured.id);
      if (!raw) return;
      featured.lineup = await buildMatchLineupPayload(raw, { fetchExternalShirts: true });
    }),
  ]);

  const [liveWithStream, nextWithStream, recentFinishedWithStream] = await Promise.all([
    attachStreamMetaToMatches(liveMatches),
    attachStreamMetaToMatches(nextUpcomingMatches),
    attachStreamMetaToMatches(recentFinishedMatches),
  ]);

  let enrichedLeaderboard = leaderboard;
  let prizePool = null;

  if (groupId && groupId !== '__nogroup') {
    await syncMemberEntryFees(groupId);
    const entryStats = await getGroupEntryFeeStats(groupId);
    const winnersCount = groupResult.group?.prizesWinnersCount ?? 0;
    const projection = await projectPrizeDistribution(groupId, { leaderboard });
    if (winnersCount > 0 && projection.distribution?.length) {
      enrichedLeaderboard = attachProjectedFubolsToLeaderboard(leaderboard, projection);
      prizePool = {
        totalFubols: projection.totalFubols,
        status: projection.status,
        houseRetention: projection.houseRetention,
        distributionPercents: projection.distributionPercents,
        distribution: projection.distribution,
        memberCount: entryStats.memberCount,
        paidEntryCount: entryStats.paidEntryCount,
        pendingEntryCount: entryStats.pendingEntryCount,
        expectedEntryFubols: entryStats.expectedEntryFubols,
        entryFeeFubols: entryStats.entryFeeFubols,
      };
    }
  }

  return {
    leaderboard: enrichedLeaderboard,
    leaderboardKickoffBaseline,
    leaderboardLiveStatIndicators,
    group: groupResult.group,
    prizePool,
    lastSyncAt,
    liveMatches: liveWithStream,
    recentFinishedMatches: recentFinishedWithStream,
    nextUpcomingMatches: nextWithStream,
  };
}

export async function getRankingFinishedArchive() {
  const finishedMatches = await getCachedRankingFinishedMatches();
  return { finishedMatches };
}
