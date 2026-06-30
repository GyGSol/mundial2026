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

function parseScoreKey(scoreKey) {
  if (!scoreKey || typeof scoreKey !== 'string') return null;
  const [homeRaw, awayRaw] = scoreKey.split('-');
  const home = Number(homeRaw);
  const away = Number(awayRaw);
  if (!Number.isFinite(home) || !Number.isFinite(away)) return null;
  return { home, away };
}

function normalizeTrainingScorePair(score) {
  if (score?.home == null || score?.away == null) return null;
  const home = Number(score.home);
  const away = Number(score.away);
  if (!Number.isFinite(home) || !Number.isFinite(away)) return null;
  return { home, away };
}

export function resolveTrainingBufferScores(row = {}) {
  const predictedScore =
    normalizeTrainingScorePair(row.predictedScore) ??
    normalizeTrainingScorePair(row.shadowOracle?.predictedScore);

  const actualScore =
    normalizeTrainingScorePair(row.actualScore) ?? parseScoreKey(row.actualScoreKey);

  return { predictedScore, actualScore };
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

/**
 * Replay Oracle sobre contexto pre-partido guardado y enriquece TrainingBuffer.
 * No modifica la predicción publicada ni el leaderboard.
 */
export async function replayOracleLearningForMatch(
  matchId,
  { fetchImpl, force = false, cerebrasPriority } = {}
) {
  const aiUser = await getAiUser();
  if (!aiUser) return { replayed: false, reason: 'no_ai_user' };

  const match = await Match.findById(matchId).lean();
  if (!match || match.status !== 'finished') {
    return { replayed: false, reason: 'not_finished' };
  }
  if (match.homeScore == null || match.awayScore == null) {
    return { replayed: false, reason: 'no_score' };
  }

  const actualScoreKey = matchResultScoreKey(match);
  if (!actualScoreKey) return { replayed: false, reason: 'no_score_key' };

  const buffer = await TrainingBuffer.findOne({ matchId: match._id, actualScoreKey }).lean();
  if (!force && buffer?.shadowOracle?.replayedAt && buffer?.oracleMeta?.confidence_interval != null) {
    return { replayed: false, reason: 'already_replayed', shadowMse: buffer.shadowOracle.mseError };
  }

  const log = await AiCompetitorPredictionLog.findOne({
    matchId: match._id,
    userId: aiUser._id,
    isSimulation: { $ne: true },
    promptContext: { $exists: true, $ne: null },
  })
    .sort({ createdAt: -1 })
    .select('promptContext finalResponse')
    .lean();

  const promptContext = log?.promptContext ?? buffer?.promptContext;
  if (!promptContext) {
    return { replayed: false, reason: 'no_prompt_context' };
  }

  if (!force && log?.finalResponse?.oracle) {
    const oracleMeta = log.finalResponse.oracle;
    const shadowScore = {
      home: log.finalResponse.homeGoals ?? 0,
      away: log.finalResponse.awayGoals ?? 0,
    };
    const shadowMse = computeScoreMse(shadowScore, {
      home: match.homeScore,
      away: match.awayScore,
    });
    await TrainingBuffer.findOneAndUpdate(
      { matchId: match._id, actualScoreKey },
      {
        $set: {
          oracleMeta: {
            confidence_interval: oracleMeta.confidence_interval ?? null,
            error_reduction_factor: oracleMeta.error_reduction_factor ?? null,
            key_variable_impact: oracleMeta.key_variable_impact ?? null,
          },
          shadowOracle: {
            predictedScore: shadowScore,
            mseError: shadowMse,
            source: log.finalResponse.source ?? 'cerebras-oracle',
            replayedAt: new Date(),
            usedStoredContext: true,
          },
          promptContext,
        },
      },
      { upsert: false }
    );
    return {
      replayed: true,
      fromLog: true,
      shadowScore,
      shadowMse,
      source: log.finalResponse.source,
    };
  }

  const { predictScoreFromAuditContext } = await import('./predictiveModelingService.js');
  const oracleResult = await predictScoreFromAuditContext(promptContext, {
    fetchImpl,
    cerebrasPriority,
  });
  if (!oracleResult) {
    return { replayed: false, reason: 'oracle_empty' };
  }

  const shadowScore = {
    home: oracleResult.homeGoals,
    away: oracleResult.awayGoals,
  };
  const shadowMse = computeScoreMse(shadowScore, {
    home: match.homeScore,
    away: match.awayScore,
  });

  const prediction = await Prediction.findOne({
    userId: aiUser._id,
    matchId: match._id,
    predictionSource: 'ai',
  })
    .select('_id')
    .lean();

  const oracleMeta = oracleResult.oracle
    ? {
        confidence_interval: oracleResult.oracle.confidence_interval ?? null,
        error_reduction_factor: oracleResult.oracle.error_reduction_factor ?? null,
        key_variable_impact: oracleResult.oracle.key_variable_impact ?? null,
      }
    : null;

  await TrainingBuffer.findOneAndUpdate(
    { matchId: match._id, actualScoreKey },
    {
      $set: {
        ...(prediction ? { predictionId: prediction._id } : {}),
        promptContext,
        oracleMeta,
        shadowOracle: {
          predictedScore: shadowScore,
          mseError: shadowMse,
          source: oracleResult.source ?? 'cerebras-oracle',
          replayedAt: new Date(),
          usedStoredContext: true,
        },
      },
    },
    { upsert: Boolean(prediction) }
  );

  return {
    replayed: true,
    fromLog: false,
    shadowScore,
    shadowMse,
    source: oracleResult.source,
  };
}

/** Partidos finalizados del bot IA elegibles para backfill de aprendizaje. */
export async function listFinishedMatchesForAiLearning({ externalIds = [] } = {}) {
  const aiUser = await getAiUser();
  if (!aiUser) return [];

  const matchQuery = {
    status: 'finished',
    homeScore: { $ne: null },
    awayScore: { $ne: null },
  };
  if (externalIds.length) {
    matchQuery.externalId = { $in: externalIds.map(String) };
  }

  const matches = await Match.find(matchQuery).sort({ kickoffAt: 1 }).lean();
  if (!matches.length) return [];

  const preds = await Prediction.find({
    userId: aiUser._id,
    matchId: { $in: matches.map((m) => m._id) },
    predictionSource: 'ai',
  })
    .select('matchId pointsEarned')
    .lean();

  const predMatchIds = new Set(preds.map((p) => String(p.matchId)));
  return matches.filter((m) => predMatchIds.has(String(m._id)));
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

function buildExportPromptFromRow(row) {
  const ctx = row.promptContext;
  const home = ctx?.match?.homeTeamId ?? ctx?.homeTeam?.code ?? ctx?.homeTeam?.name ?? '?';
  const away = ctx?.match?.awayTeamId ?? ctx?.awayTeam?.code ?? ctx?.awayTeam?.name ?? '?';
  const group = ctx?.match?.group ?? ctx?.group ?? '';
  const shadow = row.shadowOracle?.predictedScore;
  const predHome = shadow?.home ?? row.predictedScore.home;
  const predAway = shadow?.away ?? row.predictedScore.away;
  const mseForTraining = row.shadowOracle?.mseError ?? row.mseError;
  return (
    `Mundial 2026${group ? ` grupo ${group}` : ''}\n` +
    `Local: ${home}\nVisitante: ${away}\n` +
    `Predicción previa Oracle: ${predHome}-${predAway}\n` +
    `Resultado real: ${row.actualScore.home}-${row.actualScore.away}\n` +
    `Error MSE: ${Number(mseForTraining).toFixed(2)}\n` +
    `Corrige el patrón para minimizar MSE en futuros partidos similares.`
  );
}

export function serializeTrainingBufferRow(row, { adminFeedback = null } = {}) {
  const trainingMse = row.shadowOracle?.mseError ?? row.mseError;
  return {
    prompt: buildExportPromptFromRow(row),
    completion: `${row.actualScore.home}-${row.actualScore.away}`,
    mseError: trainingMse,
    sample_weight: 1 + trainingMse,
    metadata: {
      source: 'trainingBuffer',
      tournament: 2026,
      phase: 'mundial2026',
      mse_error: trainingMse,
      published_mse_error: row.mseError,
      shadow_oracle: row.shadowOracle?.source ?? null,
      matchId: String(row.matchId),
      goal_timings: (row.microEvents ?? [])
        .filter((e) => e.type === 'goal')
        .map((e) => ({ minute: e.minute, player: e.playerName })),
      adminFeedback: adminFeedback ?? null,
    },
  };
}

export async function getTrainingBufferSummary() {
  const [total, unexported, agg] = await Promise.all([
    TrainingBuffer.countDocuments(),
    TrainingBuffer.countDocuments({ exportedAt: null }),
    TrainingBuffer.aggregate([
      {
        $group: {
          _id: null,
          avgMse: { $avg: '$mseError' },
          maxMse: { $max: '$mseError' },
          lastCreatedAt: { $max: '$createdAt' },
          lastExportedAt: { $max: '$exportedAt' },
        },
      },
    ]),
  ]);

  const stats = agg[0] ?? {};
  return {
    total,
    unexported,
    avgMse: stats.avgMse != null ? Number(stats.avgMse.toFixed(4)) : null,
    maxMse: stats.maxMse ?? null,
    lastCreatedAt: stats.lastCreatedAt ?? null,
    lastExportedAt: stats.lastExportedAt ?? null,
    alwaysRecord: env.trainingBufferAlwaysRecord,
    exportCron: env.trainingBufferExportCron,
  };
}

export async function listTrainingBufferRows({ limit = 25, onlyUnexported = false } = {}) {
  const filter = onlyUnexported ? { exportedAt: null } : {};
  const rows = await TrainingBuffer.find(filter)
    .sort({ createdAt: -1 })
    .limit(Math.min(limit, 200))
    .lean();

  return rows.map((row) => {
    const { predictedScore, actualScore } = resolveTrainingBufferScores(row);
    return {
      id: row._id.toString(),
      matchId: row.matchId?.toString?.() ?? String(row.matchId),
      predictedScore,
      actualScore,
      mseError: row.mseError,
      goalDiffCombined: row.goalDiffCombined,
      weekBucket: row.weekBucket,
      exportedAt: row.exportedAt,
      createdAt: row.createdAt,
      oracleMeta: row.oracleMeta ?? null,
    };
  });
}

/** Exporta filas no exportadas; devuelve JSONL para descarga admin (Heroku-safe). */
export async function exportTrainingBufferRecords({ limit = 2000, writeFile = false, outDir = null } = {}) {
  const rows = await listUnexportedTrainingBuffer({ limit });
  if (!rows.length) {
    return { exported: 0, filename: null, jsonl: '', records: [] };
  }

  const matchIds = [...new Set(rows.map((r) => r.matchId))];
  const logs = await AiCompetitorPredictionLog.find({
    matchId: { $in: matchIds },
    isSimulation: { $ne: true },
  })
    .sort({ createdAt: -1 })
    .select('matchId adminNotes correctedReasoning')
    .lean();

  const feedbackByMatch = new Map();
  for (const log of logs) {
    const key = String(log.matchId);
    if (feedbackByMatch.has(key)) continue;
    const notes = [log.correctedReasoning, log.adminNotes].filter(Boolean).join('\n\n').trim();
    if (notes) feedbackByMatch.set(key, notes);
  }

  const records = rows.map((row) =>
    serializeTrainingBufferRow(row, {
      adminFeedback: feedbackByMatch.get(String(row.matchId)) ?? null,
    })
  );
  const jsonl = records.map((r) => JSON.stringify(r)).join('\n');
  const bucket = rows[0]?.weekBucket ?? 'export';
  const filename = `buffer-${bucket}.jsonl`;

  if (writeFile && outDir) {
    const fs = await import('node:fs');
    fs.mkdirSync(outDir, { recursive: true });
    fs.appendFileSync(`${outDir}/${filename}`, `${jsonl}\n`, 'utf8');
  }

  await markTrainingBufferExported(rows.map((r) => r._id));

  return {
    exported: rows.length,
    filename,
    jsonl,
    records,
  };
}
