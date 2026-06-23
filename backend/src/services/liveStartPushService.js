import { Match } from '../models/Match.js';
import { notifyMatchesLiveStarted } from './pushNotificationService.js';

/** Reclama partidos para push de inicio en vivo (dedup atómico). */
export async function claimMatchesForLiveStartPush(matchIds = []) {
  const claimed = [];
  for (const matchId of matchIds) {
    const match = await Match.findOneAndUpdate(
      { _id: matchId, liveStartedPushSentAt: { $exists: false } },
      { liveStartedPushSentAt: new Date() },
      { new: true }
    ).lean();
    if (match) claimed.push(match);
  }
  return claimed;
}

/** Envía push de inicio en vivo para partidos reclamados. */
export async function notifyLiveStartForMatchIds(matchIds = []) {
  if (!matchIds.length) return { sent: 0, claimed: 0, skipped: true };
  const claimed = await claimMatchesForLiveStartPush(matchIds);
  if (!claimed.length) return { sent: 0, claimed: 0, skipped: true };
  const result = await notifyMatchesLiveStarted(claimed);
  return { ...result, claimed: claimed.length };
}
