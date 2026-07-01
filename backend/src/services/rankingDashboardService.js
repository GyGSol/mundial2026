import { Match } from '../models/Match.js';
import { getCachedLeaderboard } from './leaderboardCache.js';
import { getLiveMatchStatIndicatorsByUser } from './leaderboardService.js';
import { getLastSyncAt } from './syncService.js';
import { getCompetitionGroupById } from './competitionGroupService.js';
import {
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
} from './liveMatchPartitionService.js';
import { getCachedFeaturedBarPayload } from './liveFeaturedBarCache.js';
import { getCachedRankingDashboardShell } from './rankingDashboardShellCache.js';
import { featuredBarInputsSignature } from './matchEnrichmentRevision.js';
import { LIVE_BAR_MATCH_PROJECTION } from './liveBarMatchProjection.js';

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

/**
 * IDs para flechas del ranking: en vivo primero, luego recién finalizados en gracia
 * (mismo orden que la barra destacada — una flecha verde por partido).
 */
export function buildStatIndicatorMatchIds(liveMatchIds = [], recentFinishedMatchIds = []) {
  const seen = new Set();
  const ordered = [];
  for (const id of [...liveMatchIds, ...recentFinishedMatchIds]) {
    const key = id?.toString?.() ?? id;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    ordered.push(key);
  }
  return ordered;
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

async function fetchRankingDashboardMatchInputs() {
  const [lastSyncAt, liveRaw, upcomingRaw, recentFinishedRaw] = await Promise.all([
    getLastSyncAt(),
    Match.find({ status: 'live' })
      .select(LIVE_BAR_MATCH_PROJECTION)
      .sort({ kickoffAt: 1, externalId: 1 })
      .lean(),
    Match.find({ status: 'upcoming' })
      .sort({ kickoffAt: 1 })
      .limit(UPCOMING_MATCH_LIMIT)
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
  const nextSlotRaw = findNextUpcomingMatches(upcomingRaw);

  return {
    lastSyncAt,
    activeLiveRaw,
    recentFeaturedRaw,
    upcomingRaw,
    nextSlotRaw,
  };
}

async function buildRankingDashboardShell(groupId, userId, inputs, groupResult) {
  const { lastSyncAt, activeLiveRaw, recentFeaturedRaw, upcomingRaw, nextSlotRaw } = inputs;

  if (groupId && groupId !== '__nogroup') {
    await ensureAiCompetitorInGroup(groupId);
  }

  await prepareFifaShirtMapsForMatches(nextSlotRaw);
  const enrichedUpcoming = await enrichMatchesForRankingUpcoming(nextSlotRaw, userId);

  const liveMatchIds = activeLiveRaw.map((m) => m._id.toString());
  const recentFinishedIds = recentFeaturedRaw.map((m) => m._id.toString());
  const indicatorBaselineMatchIds = buildStatIndicatorMatchIds(liveMatchIds, recentFinishedIds);
  const hasStatIndicators = indicatorBaselineMatchIds.length > 0;
  const leaderboard = await getCachedLeaderboard(groupId || null, 100, {}, {
    hasLiveMatches: hasStatIndicators,
  });
  const [leaderboardKickoffBaseline, leaderboardLiveStatIndicators] = await Promise.all([
    hasStatIndicators
      ? getCachedLeaderboard(
          groupId || null,
          100,
          { liveKickoffBaselineMatchIds: indicatorBaselineMatchIds },
          { hasLiveMatches: true }
        )
      : Promise.resolve(null),
    hasStatIndicators
      ? getLiveMatchStatIndicatorsByUser(
          leaderboard.map((row) => row.id),
          indicatorBaselineMatchIds
        )
      : Promise.resolve(null),
  ]);

  const nextUpcomingMatches = findNextUpcomingMatches(enrichedUpcoming);

  const upcomingRawById = new Map(upcomingRaw.map((m) => [m._id.toString(), m]));
  await Promise.all(
    nextUpcomingMatches.map(async (featured) => {
      const raw = upcomingRawById.get(featured.id);
      if (!raw) return;
      featured.lineup = await buildMatchLineupPayload(raw, { fetchExternalShirts: true });
    })
  );

  const nextWithStream = await attachStreamMetaToMatches(nextUpcomingMatches);

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
    nextUpcomingMatches: nextWithStream,
  };
}

export async function getRankingDashboardShell(groupId, userId) {
  const groupResult = await resolveGroup(groupId);
  if (groupResult.notFound) {
    return { notFound: true };
  }

  const inputs = await fetchRankingDashboardMatchInputs();
  const inputsSignature = featuredBarInputsSignature(
    inputs.activeLiveRaw,
    inputs.recentFeaturedRaw
  );
  const hasLiveOrRecent =
    inputs.activeLiveRaw.length > 0 || inputs.recentFeaturedRaw.length > 0;
  const activeLiveCount = inputs.activeLiveRaw.length;

  return getCachedRankingDashboardShell(
    groupId,
    userId,
    inputsSignature,
    () => buildRankingDashboardShell(groupId, userId, inputs, groupResult),
    { hasLiveOrRecent, activeLiveCount }
  );
}

export async function getRankingDashboard(groupId, userId, detailMatchId) {
  const groupResult = await resolveGroup(groupId);
  if (groupResult.notFound) {
    return { notFound: true };
  }

  const inputs = await fetchRankingDashboardMatchInputs();
  const inputsSignature = featuredBarInputsSignature(
    inputs.activeLiveRaw,
    inputs.recentFeaturedRaw
  );
  const hasLiveOrRecent =
    inputs.activeLiveRaw.length > 0 || inputs.recentFeaturedRaw.length > 0;
  const activeLiveCount = inputs.activeLiveRaw.length;

  const [featuredBar, shell] = await Promise.all([
    getCachedFeaturedBarPayload({
      activeLiveRaw: inputs.activeLiveRaw,
      recentFeaturedRaw: inputs.recentFeaturedRaw,
      userId,
      detailMatchId,
    }),
    getCachedRankingDashboardShell(
      groupId,
      userId,
      inputsSignature,
      () => buildRankingDashboardShell(groupId, userId, inputs, groupResult),
      { hasLiveOrRecent, activeLiveCount }
    ),
  ]);

  return {
    ...shell,
    liveMatches: featuredBar.liveMatches,
    recentFinishedMatches: featuredBar.recentFinishedMatches,
  };
}

export async function getRankingFinishedArchive() {
  const finishedMatches = await getCachedRankingFinishedMatches();
  return { finishedMatches };
}
