import { Match } from '../models/Match.js';
import { Prediction } from '../models/Prediction.js';
import { User } from '../models/User.js';

export const LOCK_MS = 60 * 60 * 1000;
/** Aviso push esta cantidad de ms antes del cierre (lockAt). */
export const LOCK_REMINDER_BEFORE_LOCK_MS = 15 * 60 * 1000;

export function getLockAt(kickoffAt) {
  if (!kickoffAt) return null;
  return new Date(new Date(kickoffAt).getTime() - LOCK_MS);
}

export function getLockReminderAt(kickoffAt) {
  const lockAt = getLockAt(kickoffAt);
  if (!lockAt) return null;
  return new Date(lockAt.getTime() - LOCK_REMINDER_BEFORE_LOCK_MS);
}

export function isLockReminderDue(match, now = Date.now()) {
  if (match.status !== 'upcoming' || !match.kickoffAt || match.predictionLockReminderSentAt) {
    return false;
  }
  const lockAt = getLockAt(match.kickoffAt);
  const reminderAt = getLockReminderAt(match.kickoffAt);
  if (!lockAt || !reminderAt) return false;
  const nowMs = typeof now === 'number' ? now : now.getTime();
  return nowMs >= reminderAt.getTime() && nowMs < lockAt.getTime();
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

export function hasUserPrediction(prediction) {
  if (!prediction) return false;
  if (prediction.userSubmitted) return true;
  // Predicción cargada por admin o legacy sin flag (excluye el 0-0 automático al cierre)
  return prediction.homeGoals !== 0 || prediction.awayGoals !== 0;
}

export function enrichMatchPredictionMeta(match, prediction) {
  const predictionOpen = isPredictionOpen(match);
  const lockAt = getLockAt(match.kickoffAt);
  return {
    predictionOpen,
    lockAt: lockAt?.toISOString() ?? null,
    hasPrediction: hasUserPrediction(prediction),
  };
}

export async function ensureDefaultPredictionsForUser(userId) {
  const matches = await Match.find({ status: 'upcoming', kickoffAt: { $ne: null } }).lean();
  const lockedMatches = matches.filter(isPredictionLocked);
  if (!lockedMatches.length) return;

  await Prediction.bulkWrite(
    lockedMatches.map((match) => ({
      updateOne: {
        filter: { userId, matchId: match._id },
        update: {
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
        upsert: true,
      },
    })),
    { ordered: false }
  );
}

/** Crea 0-0 para todos los usuarios que aún no tienen predicción en este partido. */
export async function ensurePredictionsForMatch(matchId) {
  const users = await User.find().select('_id');
  let created = 0;

  for (const user of users) {
    const existing = await Prediction.findOne({ userId: user._id, matchId });
    if (existing) continue;

    await Prediction.create({
      userId: user._id,
      matchId,
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

  return created;
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
