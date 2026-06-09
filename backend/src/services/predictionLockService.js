import { Match } from '../models/Match.js';
import { Prediction } from '../models/Prediction.js';
import { User } from '../models/User.js';

export const LOCK_MS = 60 * 60 * 1000;

export function getLockAt(kickoffAt) {
  if (!kickoffAt) return null;
  return new Date(new Date(kickoffAt).getTime() - LOCK_MS);
}

export function isPredictionLocked(match) {
  if (match.status !== 'upcoming') return true;
  const lockAt = getLockAt(match.kickoffAt);
  if (!lockAt) return false;
  return Date.now() >= lockAt.getTime();
}

export function isPredictionOpen(match) {
  return !isPredictionLocked(match);
}

export function enrichMatchPredictionMeta(match, prediction) {
  const predictionOpen = isPredictionOpen(match);
  const lockAt = getLockAt(match.kickoffAt);
  return {
    predictionOpen,
    lockAt: lockAt?.toISOString() ?? null,
    hasPrediction: Boolean(prediction?.userSubmitted),
  };
}

export async function ensureDefaultPredictionsForUser(userId) {
  const matches = await Match.find({ status: 'upcoming', kickoffAt: { $ne: null } });

  for (const match of matches) {
    if (!isPredictionLocked(match)) continue;

    await Prediction.findOneAndUpdate(
      { userId, matchId: match._id },
      {
        $setOnInsert: {
          homeGoals: 0,
          awayGoals: 0,
          userSubmitted: false,
          pointsEarned: null,
          bonusPoint: 0,
          bonusReason: null,
          pointsBreakdown: null,
        },
      },
      { upsert: true }
    );
  }
}

export async function applyDefaultPredictionsForLockedMatches() {
  const matches = await Match.find({ status: 'upcoming', kickoffAt: { $ne: null } });
  const lockedMatches = matches.filter(isPredictionLocked);
  if (!lockedMatches.length) return 0;

  const users = await User.find().select('_id');
  let created = 0;

  for (const match of lockedMatches) {
    for (const user of users) {
      const existing = await Prediction.findOne({ userId: user._id, matchId: match._id });
      if (existing) continue;

      await Prediction.create({
        userId: user._id,
        matchId: match._id,
        homeGoals: 0,
        awayGoals: 0,
        userSubmitted: false,
        pointsEarned: null,
        bonusPoint: 0,
        bonusReason: null,
        pointsBreakdown: null,
      });
      created += 1;
    }
  }

  return created;
}
