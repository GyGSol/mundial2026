/**
 * Genera predicciones IA oficiales faltantes en partidos finalizados.
 * Uso:
 *   node src/scripts/backfillMissingAiPredictions.js
 *   node src/scripts/backfillMissingAiPredictions.js 33 34 36
 */
import mongoose from 'mongoose';
import { connectDb } from '../config/db.js';
import { Match } from '../models/Match.js';
import { Prediction } from '../models/Prediction.js';
import { getAiUser } from '../services/aiUserService.js';
import {
  isOfficialAiCompetitorPrediction,
  runOfficialAiCompetitorPrediction,
} from '../services/aiPredictionService.js';

async function findFinishedWithoutOfficialPrediction(aiUserId, externalIds = []) {
  const query = { status: 'finished', kickoffAt: { $ne: null } };
  if (externalIds.length > 0) {
    query.externalId = { $in: externalIds.map(String) };
  }

  const matches = await Match.find(query).sort({ kickoffAt: 1 }).lean();
  if (matches.length === 0) return [];

  const predictions = await Prediction.find({
    userId: aiUserId,
    matchId: { $in: matches.map((m) => m._id) },
  })
    .select('matchId userSubmitted predictionSource aiModel')
    .lean();

  const predByMatch = new Map(predictions.map((p) => [p.matchId.toString(), p]));

  return matches.filter((match) => {
    const pred = predByMatch.get(match._id.toString());
    return !pred || !isOfficialAiCompetitorPrediction(pred);
  });
}

async function main() {
  const externalIds = process.argv.slice(2).filter(Boolean);

  await connectDb();
  const aiUser = await getAiUser();
  if (!aiUser) {
    console.error('Usuario IA no configurado');
    process.exit(1);
  }

  const due = await findFinishedWithoutOfficialPrediction(aiUser._id, externalIds);
  if (due.length === 0) {
    console.log('No hay partidos finalizados sin predicción IA oficial.');
    await mongoose.disconnect();
    return;
  }

  console.log(`Backfill: ${due.length} partido(s)`);
  let ok = 0;
  let fail = 0;

  for (const match of due) {
    const label = `#${match.externalId} ${match.homeTeamId} vs ${match.awayTeamId}`;
    try {
      const result = await runOfficialAiCompetitorPrediction(match._id, { retroactive: true });
      console.log(`OK ${label} → ${result.homeGoals}-${result.awayGoals}`);
      ok += 1;
    } catch (err) {
      console.error(`FAIL ${label}: ${err.message}`);
      fail += 1;
    }
  }

  console.log(`Listo: ${ok} ok, ${fail} error(es)`);
  await mongoose.disconnect();
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
