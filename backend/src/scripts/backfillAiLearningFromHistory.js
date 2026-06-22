/**
 * Backfill de aprendizaje del competidor IA sobre predicciones ya jugadas.
 * No altera predicciones publicadas ni puntos del leaderboard.
 *
 * Pasos por partido finalizado con predicción IA:
 *  1. recordValidationError — TrainingBuffer con MSE real
 *  2. getOrGenerateAiPostMatchReview — análisis post-partido (si falta)
 *  3. replayOracleLearningForMatch — shadow Oracle con promptContext guardado
 *
 * Uso:
 *   node src/scripts/backfillAiLearningFromHistory.js
 *   node src/scripts/backfillAiLearningFromHistory.js --dry-run
 *   node src/scripts/backfillAiLearningFromHistory.js --force
 *   node src/scripts/backfillAiLearningFromHistory.js --match 42 --match 38
 *   node src/scripts/backfillAiLearningFromHistory.js --skip-replay
 *   node src/scripts/backfillAiLearningFromHistory.js --skip-post-match
 *   node src/scripts/backfillAiLearningFromHistory.js --delay-ms 90000 --max-per-run 3
 */
import { connectDb } from '../config/db.js';
import { env } from '../config/env.js';
import {
  listFinishedMatchesForAiLearning,
  recordValidationError,
  replayOracleLearningForMatch,
} from '../services/trainingBufferService.js';
import { getOrGenerateAiPostMatchReview } from '../services/aiPostMatchLearningService.js';
import { Prediction } from '../models/Prediction.js';
import { getAiUser } from '../services/aiPredictionService.js';
import { CEREBRAS_PRIORITIES } from '../services/cerebrasQuotaManager.js';

function parseMatchIds(argv) {
  const ids = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--match' && argv[i + 1]) {
      ids.push(String(argv[++i]));
    }
  }
  return ids;
}

function parseNumberFlag(argv, flag, fallback) {
  const idx = argv.indexOf(flag);
  if (idx === -1 || !argv[idx + 1]) return fallback;
  const n = Number(argv[idx + 1]);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const force = argv.includes('--force');
const skipReplay = argv.includes('--skip-replay');
const skipPostMatch = argv.includes('--skip-post-match');
const externalIds = parseMatchIds(argv);
const delayMs = parseNumberFlag(argv, '--delay-ms', env.cerebrasMinGapMs * 2);
const maxPerRun = parseNumberFlag(argv, '--max-per-run', 0);

async function main() {
  if (!env.mongodbUri) {
    console.error('MONGODB_URI requerido');
    process.exit(1);
  }

  await connectDb();

  const aiUser = await getAiUser();
  if (!aiUser) {
    console.error('Usuario IA no encontrado');
    process.exit(1);
  }

  let matches = await listFinishedMatchesForAiLearning({ externalIds });
  if (maxPerRun > 0) {
    matches = matches.slice(0, maxPerRun);
  }

  if (!matches.length) {
    console.log('No hay partidos finalizados con predicción IA para procesar.');
    process.exit(0);
  }

  console.log(
    `Aprendizaje histórico: ${matches.length} partido(s)` +
      (dryRun ? ' [DRY RUN]' : '') +
      (force ? ' [FORCE]' : '') +
      (delayMs > 0 ? ` delay=${delayMs}ms` : '')
  );

  const stats = {
    bufferRecorded: 0,
    bufferSkipped: 0,
    postMatchGenerated: 0,
    postMatchSkipped: 0,
    replayOk: 0,
    replaySkipped: 0,
    replayFailed: 0,
    failed: 0,
  };

  for (const match of matches) {
    const label = `FIFA #${match.externalId ?? '?'} ${match.homeTeamId}-${match.awayTeamId}`;

    try {
      if (dryRun) {
        console.log(`[dry-run] ${label}`);
        continue;
      }

      const bufferResult = await recordValidationError(match._id);
      if (bufferResult.recorded) {
        stats.bufferRecorded += 1;
        console.log(`[buffer] ${label} MSE=${bufferResult.mseError}`);
      } else {
        stats.bufferSkipped += 1;
      }

      if (!skipPostMatch) {
        const pred = await Prediction.findOne({
          userId: aiUser._id,
          matchId: match._id,
          predictionSource: 'ai',
        })
          .select('aiPostMatchReview')
          .lean();

        const hasReview = Boolean(pred?.aiPostMatchReview?.analysis?.trim());
        if (!hasReview || force) {
          await getOrGenerateAiPostMatchReview(match._id, { refresh: force && hasReview });
          stats.postMatchGenerated += 1;
          console.log(`[post-match] ${label}`);
          if (delayMs > 0) await sleep(delayMs);
        } else {
          stats.postMatchSkipped += 1;
        }
      }

      if (!skipReplay) {
        const replayResult = await replayOracleLearningForMatch(match._id, {
          force,
          cerebrasPriority: CEREBRAS_PRIORITIES.backfill,
        });
        if (replayResult.replayed) {
          stats.replayOk += 1;
          const src = replayResult.source ?? (replayResult.fromLog ? 'log' : 'replay');
          console.log(
            `[replay] ${label} shadow=${replayResult.shadowScore.home}-${replayResult.shadowScore.away}` +
              ` MSE=${replayResult.shadowMse} (${src})`
          );
        } else if (replayResult.reason === 'already_replayed') {
          stats.replaySkipped += 1;
        } else {
          stats.replayFailed += 1;
          console.warn(`[replay-skip] ${label}: ${replayResult.reason}`);
        }
        if (delayMs > 0) await sleep(delayMs);
      }
    } catch (err) {
      stats.failed += 1;
      console.error(`[fail] ${label}: ${err.message}`);
    }
  }

  console.log('\nResumen:', JSON.stringify(stats, null, 2));
  process.exit(stats.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
