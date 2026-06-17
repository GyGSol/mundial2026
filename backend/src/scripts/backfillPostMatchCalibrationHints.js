/**
 * Pobla calibrationHint y humanConsensusAtReview en informes post-partido existentes.
 * Con --regenerate vuelve a generar el análisis completo vía IA (lento).
 *
 * Uso:
 *   node src/scripts/backfillPostMatchCalibrationHints.js
 *   node src/scripts/backfillPostMatchCalibrationHints.js --regenerate
 */
import { connectDb } from '../config/db.js';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { Match } from '../models/Match.js';
import { Prediction } from '../models/Prediction.js';
import {
  buildCalibrationHintFromReview,
  loadHumanConsensusForMatch,
} from '../services/aiPredictionCalibrationService.js';
import { getOrGenerateAiPostMatchReview } from '../services/aiPostMatchLearningService.js';

const regenerate = process.argv.includes('--regenerate');

async function main() {
  if (!env.mongodbUri) {
    console.error('MONGODB_URI requerido');
    process.exit(1);
  }

  await connectDb();

  const aiUser = await User.findOne({
    $or: [{ isAiUser: true }, { email: env.aiUserEmail }],
  })
    .select('_id email')
    .lean();

  if (!aiUser) {
    console.error('Usuario IA no encontrado');
    process.exit(1);
  }

  const preds = await Prediction.find({
    userId: aiUser._id,
    predictionSource: 'ai',
    pointsEarned: { $ne: null },
  })
    .select('matchId homeGoals awayGoals aiPostMatchReview')
    .lean();

  const matchIds = [...new Set(preds.map((p) => String(p.matchId)))];
  const matches = await Match.find({
    _id: { $in: matchIds },
    status: 'finished',
    homeScore: { $ne: null },
    awayScore: { $ne: null },
  })
    .select('_id externalId homeTeamId awayTeamId homeScore awayScore status')
    .lean();

  const matchById = Object.fromEntries(matches.map((m) => [String(m._id), m]));

  let backfilled = 0;
  let regenerated = 0;
  let skipped = 0;
  let failed = 0;

  for (const pred of preds) {
    const match = matchById[String(pred.matchId)];
    if (!match) {
      skipped += 1;
      continue;
    }

    const review = pred.aiPostMatchReview ?? {};
    const hasAnalysis = Boolean(review.analysis?.trim());
    const hasHint = review.calibrationHint?.biasHome != null;

    if (regenerate || !hasAnalysis) {
      try {
        await getOrGenerateAiPostMatchReview(match._id, { refresh: regenerate || !hasAnalysis });
        regenerated += 1;
        console.log(`[regen] FIFA #${match.externalId ?? '?'} ${match.homeTeamId}-${match.awayTeamId}`);
      } catch (err) {
        failed += 1;
        console.error(`[fail] match ${match._id}: ${err.message}`);
      }
      continue;
    }

    if (hasHint && review.humanConsensusAtReview?.muestras != null) {
      skipped += 1;
      continue;
    }

    const humanConsensus = await loadHumanConsensusForMatch(match._id, {
      excludeUserId: aiUser._id,
    });
    const calibrationHint = buildCalibrationHintFromReview(pred, match, review.analysis);

    await Prediction.updateOne(
      { _id: pred._id },
      {
        $set: {
          'aiPostMatchReview.calibrationHint': calibrationHint,
          'aiPostMatchReview.humanConsensusAtReview': humanConsensus
            ? {
                muestras: humanConsensus.muestras,
                mediana: humanConsensus.mediana,
                resultadoFrecuente: humanConsensus.resultadoFrecuente,
              }
            : null,
        },
      }
    );

    backfilled += 1;
    console.log(
      `[backfill] FIFA #${match.externalId ?? '?'} hint H${calibrationHint.biasHome} A${calibrationHint.biasAway}` +
        (humanConsensus?.muestras ? ` (${humanConsensus.muestras} humanos)` : '')
    );
  }

  console.log(
    `\nListo: backfill=${backfilled} regenerate=${regenerated} skipped=${skipped} failed=${failed}`
  );
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
