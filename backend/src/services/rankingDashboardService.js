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

const RECENT_FINISHED_MS = 7 * 24 * 60 * 60 * 1000;

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

  const cutoff = new Date(Date.now() - RECENT_FINISHED_MS);

  const [lastSyncAt, liveRaw, finishedRaw, upcomingRaw] = await Promise.all([
    getLastSyncAt(),
    Match.find({ status: 'live' }).sort({ kickoffAt: 1, externalId: 1 }).lean(),
    Match.find({ status: 'finished', kickoffAt: { $gte: cutoff } })
      .sort({ kickoffAt: -1 })
      .lean(),
    Match.find({ status: 'upcoming' }).select('-raw').sort({ kickoffAt: 1 }).lean(),
  ]);

  const liveMatchIds = liveRaw.map((match) => match._id.toString());
  const indicatorBaselineMatchIds = liveMatchIdsForStatIndicators(liveMatchIds);
  const [leaderboard, leaderboardKickoffBaseline] = await Promise.all([
    getLeaderboard(groupId || null),
    indicatorBaselineMatchIds.length > 0
      ? getLeaderboard(groupId || null, 100, {
          excludeMatchIds: indicatorBaselineMatchIds,
        })
      : Promise.resolve(null),
  ]);

  const matchesToEnrich = [...liveRaw, ...finishedRaw, ...upcomingRaw];
  await prepareFifaShirtMapsForMatches(matchesToEnrich);
  const enriched = await enrichMatchesLight(matchesToEnrich, userId);
  const byId = new Map(enriched.map((m) => [m.id, m]));

  const liveMatches = liveRaw.map((m) => byId.get(m._id.toString())).filter(Boolean);
  const recentFinishedMatches = finishedRaw
    .map((m) => byId.get(m._id.toString()))
    .filter(Boolean);
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
    const winnersCount = groupResult.group?.prizesWinnersCount ?? 0;
    const projection = await projectPrizeDistribution(groupId);
    if (winnersCount > 0 && projection.distribution?.length) {
      enrichedLeaderboard = attachProjectedFubolsToLeaderboard(leaderboard, projection);
      prizePool = {
        totalFubols: projection.totalFubols,
        status: projection.status,
        houseRetention: projection.houseRetention,
        distributionPercents: projection.distributionPercents,
        distribution: projection.distribution,
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
    recentFinishedMatches,
    nextUpcomingMatches: nextWithStream,
  };
}
