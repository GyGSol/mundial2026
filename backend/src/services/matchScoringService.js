import { Match } from '../models/Match.js';
import { Prediction } from '../models/Prediction.js';
import { calculatePoints } from './scoringService.js';
import { recalculateConsolationBonuses } from './consolationBonusService.js';
import { recalculateUserTotalPoints } from './leaderboardService.js';
import { ensurePredictionsForMatch } from './predictionLockService.js';
import { notifyLeaderboardUpdated } from './websocketService.js';

export async function recalculateMatchScores(matchId) {
  const match = await Match.findById(matchId);
  if (!match || (match.status !== 'finished' && match.status !== 'live')) {
    return { predictions: 0, users: 0 };
  }

  await ensurePredictionsForMatch(matchId);

  const predictions = await Prediction.find({ matchId });
  const affectedUsers = new Set();

  for (const prediction of predictions) {
    const { total, breakdown } = calculatePoints(
      { home: prediction.homeGoals, away: prediction.awayGoals },
      { home: match.homeScore ?? 0, away: match.awayScore ?? 0 }
    );

    prediction.pointsEarned = total;
    prediction.pointsBreakdown = breakdown;
    prediction.bonusPoint = 0;
    prediction.bonusReason = null;
    await prediction.save();

    affectedUsers.add(prediction.userId.toString());
  }

  for (const userId of affectedUsers) {
    if (match.status === 'finished') {
      await recalculateConsolationBonuses(userId);
    }
    await recalculateUserTotalPoints(userId);
  }

  if (affectedUsers.size > 0) {
    notifyLeaderboardUpdated({
      reason: match.status === 'live' ? 'live_scores_updated' : 'scores_recalculated',
      matchId: matchId.toString(),
    });
  }

  return { predictions: predictions.length, users: affectedUsers.size };
}

/** Quita puntos provisionales o erróneos cuando un partido vuelve a upcoming. */
export async function clearMatchScores(matchId) {
  const match = await Match.findById(matchId);
  if (!match) return { predictions: 0, users: 0 };

  const predictions = await Prediction.find({
    matchId,
    pointsEarned: { $ne: null },
  });
  if (!predictions.length) return { predictions: 0, users: 0 };

  const affectedUsers = new Set(predictions.map((prediction) => prediction.userId.toString()));

  await Prediction.updateMany(
    { matchId },
    {
      $set: {
        pointsEarned: null,
        bonusPoint: 0,
        bonusReason: null,
      },
      $unset: {
        pointsBreakdown: '',
      },
    }
  );

  for (const userId of affectedUsers) {
    await recalculateConsolationBonuses(userId);
    await recalculateUserTotalPoints(userId);
  }

  notifyLeaderboardUpdated({
    reason: 'scores_cleared',
    matchId: matchId.toString(),
  });

  return { predictions: predictions.length, users: affectedUsers.size };
}

/** Limpia puntos colgados en partidos upcoming (p. ej. finished prematuro revertido). */
export async function clearStaleUpcomingMatchScores() {
  const upcomingMatches = await Match.find({ status: 'upcoming' }).select('_id').lean();
  let clearedMatches = 0;
  let clearedPredictions = 0;

  for (const match of upcomingMatches) {
    const { predictions, users } = await clearMatchScores(match._id);
    if (predictions > 0) {
      clearedMatches += 1;
      clearedPredictions += predictions;
    }
    void users;
  }

  return { clearedMatches, clearedPredictions };
}

/** Recalcula puntos provisionales de todos los partidos en vivo. */
export async function recalculateAllLiveMatches() {
  const liveMatches = await Match.find({ status: 'live' }).select('_id');
  let totalUsers = 0;

  for (const match of liveMatches) {
    const { users } = await recalculateMatchScores(match._id);
    totalUsers += users;
  }

  return { matches: liveMatches.length, users: totalUsers };
}
