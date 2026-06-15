import { Match } from '../models/Match.js';
import { getLeaderboard } from './leaderboardService.js';
import { getLastSyncAt } from './syncService.js';
import { getCompetitionGroupById } from './competitionGroupService.js';
import {
  enrichMatchesLight,
  prepareFifaShirtMapsForMatches,
} from './matchEnrichmentService.js';
import { attachStreamMetaToMatches } from './streamMetaService.js';

const RECENT_FINISHED_MS = 7 * 24 * 60 * 60 * 1000;
const RECENT_FINISHED_MAX = 12;
/** Tras el kickoff, seguimos enviando baseline para flechas de pts (en vivo y recién finalizado). */
const BASELINE_MATCH_KICKOFF_WINDOW_MS = 4 * 60 * 60 * 1000;

function kickoffKey(kickoffAt) {
  if (!kickoffAt) return '';
  const ms = new Date(kickoffAt).getTime();
  return Number.isNaN(ms) ? String(kickoffAt) : String(ms);
}

/** Partidos finalizados recientes cuyos pts aún deben mostrar flecha vs baseline 0-0. */
export function finishedMatchIdsForPointsBaseline(finishedMatches, now = Date.now()) {
  return finishedMatches
    .filter((match) => {
      const kickoffMs = new Date(match.kickoffAt).getTime();
      return Number.isFinite(kickoffMs) && now - kickoffMs < BASELINE_MATCH_KICKOFF_WINDOW_MS;
    })
    .map((match) => match._id.toString());
}

export function mergePointsBaselineMatchIds(liveMatchIds, finishedMatches, now = Date.now()) {
  return [
    ...new Set([
      ...liveMatchIds,
      ...finishedMatchIdsForPointsBaseline(finishedMatches, now),
    ]),
  ];
}

function findNextUpcomingMatches(matches) {
  const upcoming = [...matches]
    .filter((m) => m.status === 'upcoming' && m.kickoffAt)
    .sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime());
  if (!upcoming.length) return [];
  const slot = kickoffKey(upcoming[0].kickoffAt);
  return upcoming.filter((m) => kickoffKey(m.kickoffAt) === slot);
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
    Match.find({ status: 'live' }).lean(),
    Match.find({ status: 'finished', kickoffAt: { $gte: cutoff } })
      .sort({ kickoffAt: -1 })
      .limit(RECENT_FINISHED_MAX)
      .lean(),
    Match.find({ status: 'upcoming' }).select('-raw').sort({ kickoffAt: 1 }).lean(),
  ]);

  const liveMatchIds = liveRaw.map((match) => match._id.toString());
  const indicatorBaselineMatchIds = mergePointsBaselineMatchIds(liveMatchIds, finishedRaw);
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

  return {
    leaderboard,
    leaderboardKickoffBaseline,
    group: groupResult.group,
    lastSyncAt,
    liveMatches: liveWithStream,
    recentFinishedMatches,
    nextUpcomingMatches: nextWithStream,
  };
}
