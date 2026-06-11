import { createServer } from 'http';
import { createApp } from './app.js';
import { connectDb } from './config/db.js';
import { env } from './config/env.js';
import { startSyncJob } from './jobs/syncMatches.job.js';
import { startKickoffWatchJob } from './jobs/kickoffWatch.job.js';
import { initWebSocket } from './services/websocketService.js';
import { backfillLegacyUserSubmittedPredictions } from './services/predictionMigrationService.js';

async function main() {
  await connectDb();

  try {
    const { updated, rescoredMatches } = await backfillLegacyUserSubmittedPredictions();
    if (updated > 0) {
      console.log(
        `Backfill userSubmitted: ${updated} predicciones, ${rescoredMatches} partidos rescored`
      );
    }
  } catch (err) {
    console.error('Backfill userSubmitted failed:', err);
  }

  const app = createApp();
  const server = createServer(app);

  initWebSocket(server);
  startSyncJob();
  startKickoffWatchJob();

  server.listen(env.port, () => {
    console.log(`Server listening on port ${env.port} (HTTP + WS /ws)`);
  });
}

main().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
