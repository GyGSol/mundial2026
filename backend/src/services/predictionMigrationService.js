import { Match } from '../models/Match.js';
import { Prediction } from '../models/Prediction.js';
import { SyncMeta } from '../models/SyncMeta.js';
import { getLockAt } from './predictionLockService.js';
import { recalculateMatchScores } from './syncService.js';
import { calculateGoalDiff } from './scoringService.js';

const LEGACY_BACKFILL_META_KEY = 'legacyUserSubmittedBackfill';
const PREDICTION_SOURCE_BACKFILL_META_KEY = 'predictionSourceUserBackfill';
const GOAL_DIFF_BACKFILL_META_KEY = 'predictionGoalDiffBackfill';

const LEGACY_CREATED_BEFORE_LOCK_MS = 1000;

/**
 * Predicciones guardadas antes de userSubmitted: marcador distinto de 0-0,
 * o creadas antes del cierre (1 h pre kickoff). Excluye el 0-0 automático al lock.
 */
export function isLegacyUserPrediction(prediction, match) {
  if (prediction.userSubmitted) return false;
  if (prediction.homeGoals !== 0 || prediction.awayGoals !== 0) return true;

  const lockAt = getLockAt(match.kickoffAt);
  if (!lockAt || !prediction.createdAt) return false;

  return (
    new Date(prediction.createdAt).getTime() <
    lockAt.getTime() - LEGACY_CREATED_BEFORE_LOCK_MS
  );
}

export async function backfillLegacyUserSubmittedPredictions() {
  const predictions = await Prediction.find({ userSubmitted: { $ne: true } }).lean();
  if (!predictions.length) return { updated: 0, rescoredMatches: 0 };

  const matchIds = [...new Set(predictions.map((p) => p.matchId.toString()))];
  const matches = await Match.find({ _id: { $in: matchIds } }).lean();
  const matchMap = new Map(matches.map((m) => [m._id.toString(), m]));

  const idsToUpdate = [];
  const finishedMatchIds = new Set();

  for (const prediction of predictions) {
    const match = matchMap.get(prediction.matchId.toString());
    if (!match || !isLegacyUserPrediction(prediction, match)) continue;

    idsToUpdate.push(prediction._id);
    if (match.status === 'finished') {
      finishedMatchIds.add(match._id.toString());
    }
  }

  if (!idsToUpdate.length) return { updated: 0, rescoredMatches: 0 };

  await Prediction.updateMany(
    { _id: { $in: idsToUpdate } },
    { $set: { userSubmitted: true } }
  );

  let rescoredMatches = 0;
  for (const matchId of finishedMatchIds) {
    await recalculateMatchScores(matchId);
    rescoredMatches += 1;
  }

  return { updated: idsToUpdate.length, rescoredMatches };
}

let legacyBackfillOncePromise = null;

/** Runs legacy backfill at most once per deployment (flag in SyncMeta). */
export async function ensureLegacyUserSubmittedBackfillOnce() {
  if (legacyBackfillOncePromise) return legacyBackfillOncePromise;

  legacyBackfillOncePromise = (async () => {
    const existing = await SyncMeta.findOne({ key: LEGACY_BACKFILL_META_KEY }).lean();
    if (existing?.lastSyncAt) {
      return { skipped: true, updated: 0, rescoredMatches: 0 };
    }

    const result = await backfillLegacyUserSubmittedPredictions();
    await SyncMeta.findOneAndUpdate(
      { key: LEGACY_BACKFILL_META_KEY },
      { lastSyncAt: new Date() },
      { upsert: true }
    );
    return { skipped: false, ...result };
  })().catch((err) => {
    legacyBackfillOncePromise = null;
    throw err;
  });

  return legacyBackfillOncePromise;
}

export async function backfillSubmittedPredictionSource() {
  const result = await Prediction.updateMany(
    { userSubmitted: true, predictionSource: 'default' },
    { $set: { predictionSource: 'user' } }
  );
  return { updated: result.modifiedCount };
}

let predictionSourceBackfillOncePromise = null;

/** Runs predictionSource backfill at most once per deployment (flag in SyncMeta). */
export async function ensurePredictionSourceBackfillOnce() {
  if (predictionSourceBackfillOncePromise) return predictionSourceBackfillOncePromise;

  predictionSourceBackfillOncePromise = (async () => {
    const existing = await SyncMeta.findOne({ key: PREDICTION_SOURCE_BACKFILL_META_KEY }).lean();
    if (existing?.lastSyncAt) {
      return { skipped: true, updated: 0 };
    }

    const result = await backfillSubmittedPredictionSource();
    await SyncMeta.findOneAndUpdate(
      { key: PREDICTION_SOURCE_BACKFILL_META_KEY },
      { lastSyncAt: new Date() },
      { upsert: true }
    );
    return { skipped: false, ...result };
  })().catch((err) => {
    predictionSourceBackfillOncePromise = null;
    throw err;
  });

  return predictionSourceBackfillOncePromise;
}

/**
 * Persiste goalDiffHome/goalDiffAway comparando predicciones puntuadas
 * contra el resultado del partido (finalizado o en vivo).
 */
export async function backfillPredictionGoalDiffs({ onlyMissing = true } = {}) {
  const filter = {
    pointsEarned: { $ne: null },
  };
  if (onlyMissing) {
    filter.$or = [{ goalDiffHome: null }, { goalDiffAway: null }];
  }

  const predictions = await Prediction.find(filter)
    .select(
      '_id matchId homeGoals awayGoals goalDiffHome goalDiffAway liveKickoffGoalDiffHome liveKickoffGoalDiffAway'
    )
    .lean();

  if (!predictions.length) {
    return { updated: 0, matches: 0, skipped: 0 };
  }

  const matchIds = [...new Set(predictions.map((prediction) => prediction.matchId.toString()))];
  const matches = await Match.find({
    _id: { $in: matchIds },
    status: { $in: ['finished', 'live'] },
  })
    .select('homeScore awayScore liveScoringInitialized')
    .lean();
  const matchMap = new Map(matches.map((match) => [match._id.toString(), match]));

  const bulkOps = [];
  let skipped = 0;

  for (const prediction of predictions) {
    const match = matchMap.get(prediction.matchId.toString());
    if (!match) {
      skipped += 1;
      continue;
    }

    const predicted = { home: prediction.homeGoals, away: prediction.awayGoals };
    const actual = { home: match.homeScore ?? 0, away: match.awayScore ?? 0 };
    const goalDiff = calculateGoalDiff(predicted, actual);

    const update = {
      goalDiffHome: goalDiff.home,
      goalDiffAway: goalDiff.away,
    };

    if (match.liveScoringInitialized) {
      const kickoffDiff = calculateGoalDiff(predicted, { home: 0, away: 0 });
      update.liveKickoffGoalDiffHome = kickoffDiff.home;
      update.liveKickoffGoalDiffAway = kickoffDiff.away;
    }

    bulkOps.push({
      updateOne: {
        filter: { _id: prediction._id },
        update: { $set: update },
      },
    });
  }

  if (bulkOps.length) {
    await Prediction.bulkWrite(bulkOps, { ordered: false });
  }

  return { updated: bulkOps.length, matches: matches.length, skipped };
}

let goalDiffBackfillOncePromise = null;

/** Backfill de dif. goles al menos una vez por despliegue (SyncMeta). */
export async function ensurePredictionGoalDiffBackfillOnce() {
  if (goalDiffBackfillOncePromise) return goalDiffBackfillOncePromise;

  goalDiffBackfillOncePromise = (async () => {
    const existing = await SyncMeta.findOne({ key: GOAL_DIFF_BACKFILL_META_KEY }).lean();
    if (existing?.lastSyncAt) {
      return { skipped: true, updated: 0, matches: 0 };
    }

    const result = await backfillPredictionGoalDiffs({ onlyMissing: true });
    await SyncMeta.findOneAndUpdate(
      { key: GOAL_DIFF_BACKFILL_META_KEY },
      { lastSyncAt: new Date() },
      { upsert: true }
    );
    return { skipped: false, ...result };
  })().catch((err) => {
    goalDiffBackfillOncePromise = null;
    throw err;
  });

  return goalDiffBackfillOncePromise;
}
