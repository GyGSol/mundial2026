import { Match } from '../models/Match.js';
import { Prediction } from '../models/Prediction.js';
import { User } from '../models/User.js';

export const CONSOLATION_STREAK = 3;
export const CONSOLATION_BONUS = 1;
export const CONSOLATION_REASON =
  'Punto consuelo (PB): 3 partidos seguidos sin sumar puntos';

export async function recalculateConsolationBonuses(userId) {
  const user = await User.findById(userId).select('isAiUser').lean();

  await Prediction.updateMany(
    { userId },
    { $set: { bonusPoint: 0, bonusReason: null } }
  );

  if (user?.isAiUser) {
    return;
  }

  const predictions = await Prediction.find({
    userId,
    pointsEarned: { $ne: null },
  });

  if (!predictions.length) return;

  const matchIds = predictions.map((prediction) => prediction.matchId);
  const matches = await Match.find({
    _id: { $in: matchIds },
    status: 'finished',
  });
  const matchMap = Object.fromEntries(
    matches.map((match) => [match._id.toString(), match])
  );

  const scored = predictions
    .filter((prediction) => matchMap[prediction.matchId.toString()])
    .sort((a, b) => {
      const kickoffA = matchMap[a.matchId.toString()].kickoffAt || 0;
      const kickoffB = matchMap[b.matchId.toString()].kickoffAt || 0;
      if (kickoffA !== kickoffB) {
        return new Date(kickoffA) - new Date(kickoffB);
      }
      return a.matchId.toString().localeCompare(b.matchId.toString());
    });

  let streak = 0;
  for (const prediction of scored) {
    if ((prediction.pointsEarned ?? 0) === 0) {
      streak += 1;
      if (streak === CONSOLATION_STREAK) {
        prediction.bonusPoint = CONSOLATION_BONUS;
        prediction.bonusReason = CONSOLATION_REASON;
        await prediction.save();
        streak = 0;
      }
    } else {
      streak = 0;
    }
  }
}
