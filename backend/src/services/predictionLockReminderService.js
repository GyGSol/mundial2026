import { Match } from '../models/Match.js';
import { Prediction } from '../models/Prediction.js';
import { User } from '../models/User.js';
import {
  LOCK_MS,
  LOCK_REMINDER_BEFORE_LOCK_MS,
  hasUserPrediction,
  isLockReminderDue,
} from './predictionLockService.js';
import { notifyPredictionLockClosing } from './pushNotificationService.js';

export function getKickoffRangeForLockReminder(now = Date.now()) {
  const nowMs = typeof now === 'number' ? now : now.getTime();
  return {
    $gt: new Date(nowMs + LOCK_MS),
    $lte: new Date(nowMs + LOCK_MS + LOCK_REMINDER_BEFORE_LOCK_MS),
  };
}

export async function findMatchesDueForLockReminder(now = Date.now()) {
  const kickoffAt = getKickoffRangeForLockReminder(now);
  const candidates = await Match.find({
    status: 'upcoming',
    kickoffAt,
    predictionLockReminderSentAt: { $exists: false },
  }).lean();

  return candidates.filter((match) => isLockReminderDue(match, now));
}

export async function findUsersNeedingLockReminder(matchId) {
  const [usersWithPush, predictions] = await Promise.all([
    User.find({
      'pushSubscriptions.0': { $exists: true },
      'notificationPreferences.predictionLockReminder': { $ne: false },
    })
      .select('_id pushSubscriptions notificationPreferences')
      .lean(),
    Prediction.find({ matchId }).select('userId homeGoals awayGoals userSubmitted').lean(),
  ]);

  const coveredUserIds = new Set(
    predictions.filter((prediction) => hasUserPrediction(prediction)).map((p) => String(p.userId))
  );

  return usersWithPush.filter((user) => !coveredUserIds.has(String(user._id)));
}

export async function runPredictionLockReminderTick({ now = Date.now() } = {}) {
  const dueMatches = await findMatchesDueForLockReminder(now);
  if (!dueMatches.length) {
    return { matches: 0, notifiedUsers: 0, sent: 0, skipped: true };
  }

  let notifiedUsers = 0;
  let sent = 0;

  for (const match of dueMatches) {
    const claimed = await Match.findOneAndUpdate(
      {
        _id: match._id,
        predictionLockReminderSentAt: { $exists: false },
      },
      { predictionLockReminderSentAt: new Date(now) },
      { new: true }
    ).lean();

    if (!claimed) continue;

    const users = await findUsersNeedingLockReminder(match._id);
    if (!users.length) continue;

    const result = await notifyPredictionLockClosing(claimed, users);
    notifiedUsers += users.length;
    sent += result.sent ?? 0;
  }

  return { matches: dueMatches.length, notifiedUsers, sent, skipped: false };
}
