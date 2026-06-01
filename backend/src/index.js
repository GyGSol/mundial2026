import { createServer } from 'http';
import { createApp } from './app.js';
import { connectDb } from './config/db.js';
import { env } from './config/env.js';
import { startSyncJob } from './jobs/syncMatches.job.js';
import { initWebSocket } from './services/websocketService.js';

async function main() {
  await connectDb();
  const app = createApp();
  const server = createServer(app);

  initWebSocket(server);
  startSyncJob();

  server.listen(env.port, () => {
    console.log(`Server listening on port ${env.port} (HTTP + WS /ws)`);
  });
}

main().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
