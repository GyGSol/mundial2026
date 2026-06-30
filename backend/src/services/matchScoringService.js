import { Match } from '../models/Match.js';
import { Prediction } from '../models/Prediction.js';
import { calculatePoints, calculateGoalDiff, resolveScoringActual } from './scoringService.js';
import { recalculateConsolationBonuses } from './consolationBonusService.js';
import { recalculateUserTotalPoints } from './leaderboardService.js';
import { ensurePredictionsForMatch } from './predictionLockService.js';
import { notifyLeaderboardUpdated } from './websocketService.js';
import { invalidateMatchRelatedCaches } from './matchRelatedCaches.js';
import { enqueueAiLearningForMatch } from './aiLearningQueueService.js';
import { recordValidationError } from './trainingBufferService.js';

function pointsBreakdownMatches(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  const keys = ['winner', 'homeGoals', 'awayGoals', 'totalGoals', 'exactScore', 'goalDiff'];
  return keys.every((key) => (a[key] ?? 0) === (b[key] ?? 0));
}

function predictionScoresUnchanged(prediction, total, breakdown, goalDiff, { saveLiveKickoffSnapshot }) {
  if (saveLiveKickoffSnapshot) return false;
  return (
    prediction.pointsEarned === total &&
    prediction.goalDiffHome === goalDiff.home &&
    prediction.goalDiffAway === goalDiff.away &&
    pointsBreakdownMatches(prediction.pointsBreakdown, breakdown)
  );
}

async function applyScoresForMatch(match, scoreHome, scoreAway, { saveLiveKickoffSnapshot = false } = {}) {
  const predictions = await Prediction.find({ matchId: match._id });
  const affectedUsers = new Set();
  let predictionsUpdated = 0;

  for (const prediction of predictions) {
    if (prediction.predictionSource === 'admin') continue;

    const predicted = { home: prediction.homeGoals, away: prediction.awayGoals };
    const actual = { home: scoreHome, away: scoreAway };
    const { total, breakdown } = calculatePoints(predicted, actual);
    const goalDiff = calculateGoalDiff(predicted, actual);

    if (
      predictionScoresUnchanged(prediction, total, breakdown, goalDiff, { saveLiveKickoffSnapshot })
    ) {
      continue;
    }

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

    predictionsUpdated += 1;
    affectedUsers.add(prediction.userId.toString());
  }

  for (const userId of affectedUsers) {
    if (match.status === 'finished') {
      await recalculateConsolationBonuses(userId);
    }
    await recalculateUserTotalPoints(userId);
  }

  return { predictions: predictionsUpdated, users: affectedUsers.size };
}

export async function recalculateMatchScores(matchId) {
  const match = await Match.findById(matchId);
  if (!match || (match.status !== 'finished' && match.status !== 'live')) {
    return { predictions: 0, users: 0 };
  }

  await ensurePredictionsForMatch(matchId);

  const { home: actualHome, away: actualAway } = resolveScoringActual(match);
  const needsLiveBaseline = match.status === 'live' && !match.liveScoringInitialized;

  if (needsLiveBaseline) {
    const baselineResult = await applyScoresForMatch(match, 0, 0, { saveLiveKickoffSnapshot: true });
    match.liveScoringInitialized = true;
    await match.save();

    invalidateMatchRelatedCaches();
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
    void recordValidationError(match._id).catch((err) => {
      console.warn(`Training buffer validation failed (${match.externalId}):`, err.message);
    });
    void enqueueAiLearningForMatch(match._id).catch((err) => {
      console.warn(`AI learning enqueue failed (${match.externalId}):`, err.message);
    });
  }

  if (result.users > 0 || needsLiveBaseline) {
    invalidateMatchRelatedCaches();
    notifyLeaderboardUpdated({
      reason: match.status === 'live' ? 'live_scores_updated' : 'scores_recalculated',
      matchId: matchId.toString(),
    });
  }

  return { ...result, liveBaseline: needsLiveBaseline };
}

/** Inicializa baseline 0-0 en partidos live que aún no tienen liveScoringInitialized. */
export async function ensureLiveScoringBaselines() {
  const uninitialized = await Match.find({
    status: 'live',
    liveScoringInitialized: { $ne: true },
  }).select('_id');

  let users = 0;
  for (const match of uninitialized) {
    const { users: updatedUsers } = await recalculateMatchScores(match._id);
    users += updatedUsers;
  }

  return { matches: uninitialized.length, users };
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

  invalidateMatchRelatedCaches();
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

/** Recalcula puntos de todos los partidos finalizados (p. ej. tras corregir marcador KO). */
export async function recalculateAllFinishedMatches() {
  const finished = await Match.find({ status: 'finished' }).select('_id').lean();
  let predictionsUpdated = 0;
  for (const m of finished) {
    const { predictions } = await recalculateMatchScores(m._id);
    predictionsUpdated += predictions;
  }
  return { matches: finished.length, predictionsUpdated };
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
