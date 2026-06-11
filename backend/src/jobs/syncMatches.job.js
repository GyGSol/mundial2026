import { runSync } from '../services/syncService.js';
import { applyDefaultPredictionsForLockedMatches } from '../services/predictionLockService.js';
import { Match } from '../models/Match.js';
import { env } from '../config/env.js';

let timeoutId = null;
let running = false;
let tickCount = 0;

/** Cada 60 ticks (~1 h con intervalo de 1 min) refresca equipos y grupos. */
const METADATA_SYNC_EVERY_TICKS = 60;

async function resolveSyncDelayMs() {
  const liveCount = await Match.countDocuments({ status: 'live' });
  return liveCount > 0 ? env.syncIntervalLiveMs : env.syncIntervalMs;
}

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

async function scheduleNextTick() {
  const delayMs = await resolveSyncDelayMs();
  timeoutId = setTimeout(async () => {
    await tick();
    scheduleNextTick();
  }, delayMs);
}

export function startSyncJob() {
  (async () => {
    await tick();
    await scheduleNextTick();
  })();

  const baseMinutes = env.syncIntervalMs / 60000;
  const liveSeconds = env.syncIntervalLiveMs / 1000;
  console.log(
    `Sync job started (every ${baseMinutes} min, every ${liveSeconds}s when live, metadata each ${METADATA_SYNC_EVERY_TICKS} ticks)`
  );
}

export function stopSyncJob() {
  if (timeoutId) clearTimeout(timeoutId);
  timeoutId = null;
}
