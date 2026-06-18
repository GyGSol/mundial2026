import { Match } from '../models/Match.js';
import { getLeaderboard } from './leaderboardService.js';
import { getLastSyncAt } from './syncService.js';
import { getCompetitionGroupById } from './competitionGroupService.js';
import {
  enrichMatchesLight,
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

const UPCOMING_MATCH_LIMIT = 30;

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

  const [lastSyncAt, liveRaw, upcomingRaw] = await Promise.all([
    getLastSyncAt(),
    Match.find({ status: 'live' }).sort({ kickoffAt: 1, externalId: 1 }).lean(),
    Match.find({ status: 'upcoming' })
      .select('-raw')
      .sort({ kickoffAt: 1 })
      .limit(UPCOMING_MATCH_LIMIT)
      .lean(),
  ]);

  const matchesToEnrich = [...liveRaw, ...upcomingRaw];
  await prepareFifaShirtMapsForMatches(matchesToEnrich);
  const enriched = await enrichMatchesLight(matchesToEnrich, userId);
  const byId = new Map(enriched.map((m) => [m.id, m]));

  const liveMatches = liveRaw.map((m) => byId.get(m._id.toString())).filter(Boolean);

  if (groupId && groupId !== '__nogroup') {
    await ensureAiCompetitorInGroup(groupId);
  }

  const liveMatchIds = liveMatches.map((match) => match.id);
  const indicatorBaselineMatchIds = liveMatchIdsForStatIndicators(liveMatchIds);
  // Par actual sin sub-caché: el dashboard ya cachea 5s/15s; liveKickoffBaselineMatchIds
  // deja PJ igual y puntúa el partido en vivo como 0-0 (no excludeMatchIds, que baja PJ).
  const [leaderboard, leaderboardKickoffBaseline] = await Promise.all([
    getLeaderboard(groupId || null, 100),
    indicatorBaselineMatchIds.length > 0
      ? getLeaderboard(groupId || null, 100, {
          liveKickoffBaselineMatchIds: indicatorBaselineMatchIds,
        })
      : Promise.resolve(null),
  ]);

  const nextUpcomingMatches = findNextUpcomingMatches(
    upcomingRaw.map((m) => byId.get(m._id.toString())).filter(Boolean)
  );

  const [liveWithStream, nextWithStream] = await Promise.all([
    attachStreamMetaToMatches(liveMatches),
    attachStreamMetaToMatches(nextUpcomingMatches),
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
    group: groupResult.group,
    prizePool,
    lastSyncAt,
    liveMatches: liveWithStream,
    nextUpcomingMatches: nextWithStream,
  };
}
