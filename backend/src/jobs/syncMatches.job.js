import { runSync } from '../services/syncService.js';
import { applyDefaultPredictionsForLockedMatches } from '../services/predictionLockService.js';
import { env } from '../config/env.js';

let intervalId = null;
let running = false;
let tickCount = 0;

/** Cada 60 ticks (~1 h con intervalo de 1 min) refresca equipos y grupos. */
const METADATA_SYNC_EVERY_TICKS = 60;

async function tick() {
  if (running) return;
  running = true;
  tickCount += 1;
  const includeMetadata = tickCount === 1 || tickCount % METADATA_SYNC_EVERY_TICKS === 0;

  try {
    await runSync({ includeMetadata });
    const created = await applyDefaultPredictionsForLockedMatches();
    if (created > 0) {
      console.log(`Default 0-0 predictions applied: ${created}`);
    }
  } catch (err) {
    console.error('Sync tick error:', err.message);
  } finally {
    running = false;
  }
}

export function startSyncJob() {
  tick();
  intervalId = setInterval(tick, env.syncIntervalMs);
  const minutes = env.syncIntervalMs / 60000;
  console.log(
    `Sync job started (every ${minutes} min, ~1 req/min + metadata each ${METADATA_SYNC_EVERY_TICKS} ticks)`
  );
}

export function stopSyncJob() {
  if (intervalId) clearInterval(intervalId);
}
