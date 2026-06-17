import { createServer } from 'http';
import { createApp } from './app.js';
import { connectDb } from './config/db.js';
import { env } from './config/env.js';
import { startSyncJob } from './jobs/syncMatches.job.js';
import { startKickoffWatchJob } from './jobs/kickoffWatch.job.js';
import { startPredictionLockReminderJob } from './jobs/predictionLockReminder.job.js';
import { startAiPredictionsJob } from './jobs/aiPredictions.job.js';
import { startTrainingBufferExportJob } from './jobs/trainingBufferExport.job.js';
import { initWebSocket } from './services/websocketService.js';
import { ensureLegacyUserSubmittedBackfillOnce, ensurePredictionGoalDiffBackfillOnce } from './services/predictionMigrationService.js';

const BOOT_DEFER_MS = 5_000;

async function main() {
  await connectDb();

  const app = createApp();
  const server = createServer(app);

  initWebSocket(server);
  startKickoffWatchJob();
  startPredictionLockReminderJob();
  startAiPredictionsJob();
  startTrainingBufferExportJob();

  server.listen(env.port, () => {
    console.log(`Server listening on port ${env.port} (HTTP + WS /ws)`);
  });

  setTimeout(() => {
    startSyncJob();
    ensureLegacyUserSubmittedBackfillOnce()
      .then((result) => {
        if (!result.skipped && result.updated > 0) {
          console.log(
            `Backfill userSubmitted: ${result.updated} predicciones, ${result.rescoredMatches} partidos rescored`
          );
        }
      })
      .catch((err) => {
        console.error('Deferred backfill userSubmitted failed:', err);
      });
    ensurePredictionGoalDiffBackfillOnce()
      .then((result) => {
        if (!result.skipped && result.updated > 0) {
          console.log(
            `Backfill goalDiff: ${result.updated} predicciones en ${result.matches} partidos`
          );
        }
      })
      .catch((err) => {
        console.error('Deferred backfill goalDiff failed:', err);
      });
  }, BOOT_DEFER_MS);
}

main().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
