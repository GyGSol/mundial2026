import { TrainingBuffer } from '../models/TrainingBuffer.js';
import { Match } from '../models/Match.js';
import { Prediction } from '../models/Prediction.js';
import { AiCompetitorPredictionLog } from '../models/AiCompetitorPredictionLog.js';
import { env } from '../config/env.js';
import { getAiUser } from './aiPredictionService.js';
import { goalDiffScore } from './goalDiffStats.js';
import { matchResultScoreKey } from './aiPostMatchLearningService.js';
import { listMicroEventsForMatch } from './matchMicroEventService.js';

function isoWeekBucket(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function computeScoreMse(predicted, actual) {
  const ph = Number(predicted?.home ?? 0);
  const pa = Number(predicted?.away ?? 0);
  const ah = Number(actual?.home ?? 0);
  const aa = Number(actual?.away ?? 0);
  return (ph - ah) ** 2 + (pa - aa) ** 2;
}

/** Registra desviación al finalizar partido (idempotente por matchId + marcador real). */
export async function recordValidationError(matchId) {
  const aiUser = await getAiUser();
  if (!aiUser) return { recorded: false, reason: 'no_ai_user' };

  const match = await Match.findById(matchId).lean();
  if (!match || match.status !== 'finished') {
    return { recorded: false, reason: 'not_finished' };
  }

  if (match.homeScore == null || match.awayScore == null) {
    return { recorded: false, reason: 'no_score' };
  }

  const prediction = await Prediction.findOne({
    userId: aiUser._id,
    matchId: match._id,
    predictionSource: 'ai',
  }).lean();

  if (!prediction) return { recorded: false, reason: 'no_prediction' };

  const actualScoreKey = matchResultScoreKey(match);
  if (!actualScoreKey) return { recorded: false, reason: 'no_score_key' };

  const predictedScore = {
    home: prediction.homeGoals ?? 0,
    away: prediction.awayGoals ?? 0,
  };
  const actualScore = {
    home: match.homeScore,
    away: match.awayScore,
  };

  const mseError = computeScoreMse(predictedScore, actualScore);
  if (!env.trainingBufferAlwaysRecord && mseError === 0) {
    return { recorded: false, reason: 'exact_match' };
  }

  const goalDiffCombined = goalDiffScore(
    prediction.goalDiffHome ?? 0,
    prediction.goalDiffAway ?? 0,
    1
  );

  const log = await AiCompetitorPredictionLog.findOne({
    matchId: match._id,
    userId: aiUser._id,
    isSimulation: { $ne: true },
  })
    .sort({ createdAt: -1 })
    .select('promptContext finalResponse')
    .lean();

  const microEvents = await listMicroEventsForMatch(match._id);

  const oracleMeta = log?.finalResponse?.oracle ?? null;

  const doc = await TrainingBuffer.findOneAndUpdate(
    { matchId: match._id, actualScoreKey },
    {
      $set: {
        predictionId: prediction._id,
        predictedScore,
        actualScore,
        mseError,
        goalDiffCombined: Number(goalDiffCombined.toFixed(4)),
        promptContext: log?.promptContext ?? null,
        microEvents,
        oracleMeta: oracleMeta
          ? {
              confidence_interval: oracleMeta.confidence_interval ?? null,
              error_reduction_factor: oracleMeta.error_reduction_factor ?? null,
              key_variable_impact: oracleMeta.key_variable_impact ?? null,
            }
          : null,
        weekBucket: isoWeekBucket(match.kickoffAt ?? new Date()),
      },
    },
    { upsert: true, new: true }
  );

  return { recorded: true, id: doc._id, mseError };
}

export async function listUnexportedTrainingBuffer({ limit = 500 } = {}) {
  return TrainingBuffer.find({ exportedAt: null })
    .sort({ createdAt: 1 })
    .limit(limit)
    .lean();
}

export async function markTrainingBufferExported(ids = []) {
  if (!ids.length) return { updated: 0 };
  const result = await TrainingBuffer.updateMany(
    { _id: { $in: ids } },
    { $set: { exportedAt: new Date() } }
  );
  return { updated: result.modifiedCount ?? 0 };
}
