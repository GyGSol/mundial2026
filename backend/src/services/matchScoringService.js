import { Match } from '../models/Match.js';
import { Prediction } from '../models/Prediction.js';
import { calculatePoints, calculateGoalDiff } from './scoringService.js';
import { recalculateConsolationBonuses } from './consolationBonusService.js';
import { recalculateUserTotalPoints } from './leaderboardService.js';
import { ensurePredictionsForMatch } from './predictionLockService.js';
import { notifyLeaderboardUpdated } from './websocketService.js';
import { queueAiPostMatchReview } from './aiPostMatchLearningService.js';
import { recordValidationError } from './trainingBufferService.js';

async function applyScoresForMatch(match, scoreHome, scoreAway, { saveLiveKickoffSnapshot = false } = {}) {
  const predictions = await Prediction.find({ matchId: match._id });
  const affectedUsers = new Set();

  for (const prediction of predictions) {
    const predicted = { home: prediction.homeGoals, away: prediction.awayGoals };
    const actual = { home: scoreHome, away: scoreAway };
    const { total, breakdown } = calculatePoints(predicted, actual);
    const goalDiff = calculateGoalDiff(predicted, actual);

    prediction.pointsEarned = total;
    prediction.pointsBreakdown = breakdown;
    prediction.goalDiffHome = goalDiff.home;
    prediction.goalDiffAway = goalDiff.away;
    if (saveLiveKickoffSnapshot) {
      prediction.liveKickoffPointsEarned = total;
      prediction.liveKickoffBreakdown = { ...breakdown };
      prediction.liveKickoffGoalDiffHome = goalDiff.home;
      prediction.liveKickoffGoalDiffAway = goalDiff.away;
    }
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

  return { predictions: predictions.length, users: affectedUsers.size };
}

export async function recalculateMatchScores(matchId) {
  const match = await Match.findById(matchId);
  if (!match || (match.status !== 'finished' && match.status !== 'live')) {
    return { predictions: 0, users: 0 };
  }

  await ensurePredictionsForMatch(matchId);

  const actualHome = match.homeScore ?? 0;
  const actualAway = match.awayScore ?? 0;
  const needsLiveBaseline = match.status === 'live' && !match.liveScoringInitialized;

  if (needsLiveBaseline) {
    const baselineResult = await applyScoresForMatch(match, 0, 0, { saveLiveKickoffSnapshot: true });
    match.liveScoringInitialized = true;
    await match.save();

    notifyLeaderboardUpdated({
      reason: 'live_baseline',
      matchId: matchId.toString(),
    });

    if (actualHome === 0 && actualAway === 0) {
      return { ...baselineResult, liveBaseline: true };
    }
  }

  const result = await applyScoresForMatch(match, actualHome, actualAway);

  if (match.status === 'finished') {
    void queueAiPostMatchReview(match._id).catch((err) => {
      console.warn(`AI post-match review failed (${match.externalId}):`, err.message);
    });
    void recordValidationError(match._id).catch((err) => {
      console.warn(`Training buffer validation failed (${match.externalId}):`, err.message);
    });
  }

  if (result.users > 0 || needsLiveBaseline) {
    notifyLeaderboardUpdated({
      reason: match.status === 'live' ? 'live_scores_updated' : 'scores_recalculated',
      matchId: matchId.toString(),
    });
  }

  return { ...result, liveBaseline: needsLiveBaseline };
}

/** Quita puntos provisionales o erróneos cuando un partido vuelve a upcoming. */
export async function clearMatchScores(matchId) {
  const match = await Match.findById(matchId);
  if (!match) return { predictions: 0, users: 0 };

  const predictions = await Prediction.find({
    matchId,
    pointsEarned: { $ne: null },
  });
  if (!predictions.length) {
    if (match.liveScoringInitialized) {
      match.liveScoringInitialized = false;
      await match.save();
    }
    return { predictions: 0, users: 0 };
  }

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
        goalDiffHome: '',
        goalDiffAway: '',
        liveKickoffPointsEarned: '',
        liveKickoffBreakdown: '',
        liveKickoffGoalDiffHome: '',
        liveKickoffGoalDiffAway: '',
        aiPostMatchReview: '',
      },
    }
  );

  if (match.liveScoringInitialized) {
    match.liveScoringInitialized = false;
    await match.save();
  }

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
