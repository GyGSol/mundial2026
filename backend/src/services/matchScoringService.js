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
