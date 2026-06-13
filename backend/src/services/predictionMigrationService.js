import { Match } from '../models/Match.js';
import { Prediction } from '../models/Prediction.js';
import { SyncMeta } from '../models/SyncMeta.js';
import { getLockAt } from './predictionLockService.js';
import { recalculateMatchScores } from './syncService.js';

const LEGACY_BACKFILL_META_KEY = 'legacyUserSubmittedBackfill';

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
