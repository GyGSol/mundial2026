import { Match } from '../models/Match.js';
import { getLeaderboard } from './leaderboardService.js';
import { getLastSyncAt } from './syncService.js';
import { getCompetitionGroupById } from './competitionGroupService.js';
import {
  enrichMatchesLight,
  prepareFifaShirtMapsForMatches,
} from './matchEnrichmentService.js';

const RECENT_FINISHED_MS = 7 * 24 * 60 * 60 * 1000;
const RECENT_FINISHED_MAX = 12;

function kickoffKey(kickoffAt) {
  if (!kickoffAt) return '';
  const ms = new Date(kickoffAt).getTime();
  return Number.isNaN(ms) ? String(kickoffAt) : String(ms);
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

  const [leaderboard, lastSyncAt, liveRaw, finishedRaw, upcomingRaw] = await Promise.all([
    getLeaderboard(groupId || null),
    getLastSyncAt(),
    Match.find({ status: 'live' }).lean(),
    Match.find({ status: 'finished', kickoffAt: { $gte: cutoff } })
      .sort({ kickoffAt: -1 })
      .limit(RECENT_FINISHED_MAX)
      .lean(),
    Match.find({ status: 'upcoming' }).select('-raw').sort({ kickoffAt: 1 }).lean(),
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

  return {
    leaderboard,
    group: groupResult.group,
    lastSyncAt,
    liveMatches,
    recentFinishedMatches,
    nextUpcomingMatches,
  };
}
