import { Match } from '../models/Match.js';
import { recalculateMatchScores } from './syncService.js';
import { notifyLeaderboardUpdated, notifyMatchesUpdated } from './websocketService.js';

/** Pasa a live los upcoming cuyo kickoff ya empezó (si el sync externo aún no lo hizo). */
export async function promoteMatchesAtKickoff() {
  const now = new Date();
  const due = await Match.find({
    status: 'upcoming',
    kickoffAt: { $lte: now, $ne: null },
  });

  if (!due.length) return [];

  const promotedIds = [];
  for (const match of due) {
    match.status = 'live';
    if (match.homeScore == null) match.homeScore = 0;
    if (match.awayScore == null) match.awayScore = 0;
    match.lastSyncedAt = new Date();
    await match.save();
    promotedIds.push(match._id);
    await recalculateMatchScores(match._id);
  }

  notifyMatchesUpdated({
    reason: 'kickoff_live',
    matchIds: promotedIds.map((id) => id.toString()),
  });
  notifyLeaderboardUpdated({ reason: 'kickoff_live' });

  return promotedIds;
}
