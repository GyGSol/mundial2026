import { runSync } from '../services/syncService.js';
import { applyDefaultPredictionsForLockedMatches } from '../services/predictionLockService.js';
import { Match } from '../models/Match.js';
import { env } from '../config/env.js';
import { findRecentlyFinishedMatchesQuery } from '../services/matchDisplayVisibilityService.js';
import { enqueueBackgroundWork } from '../services/backgroundWorkQueue.js';
import { resolveLiveSyncCadence } from '../services/liveSyncCadenceService.js';

let timeoutId = null;
let running = false;
let tickCount = 0;

/** Cada 60 ticks (~1 h con intervalo de 1 min) refresca equipos y grupos. */
const METADATA_SYNC_EVERY_TICKS = 60;

async function resolveSyncDelayMs() {
  const liveCount = await Match.countDocuments({ status: 'live' });
  if (liveCount > 0) {
    return resolveLiveSyncCadence(liveCount).syncIntervalLiveMs;
  }
  const recentFinishedCount = await Match.countDocuments(findRecentlyFinishedMatchesQuery());
  if (recentFinishedCount > 0) return env.syncIntervalLiveMs;
  return env.syncIntervalMs;
}

async function tick() {
  if (running) return;
  running = true;
  tickCount += 1;
  const liveCount = await Match.countDocuments({ status: 'live' });
  const includeMetadata =
    tickCount === 1 ||
    tickCount % METADATA_SYNC_EVERY_TICKS === 0 ||
    liveCount > 0;

  try {
    await enqueueBackgroundWork(
      'sync:tick',
      () => runSync({ includeMetadata }),
      { priority: 'critical', memoryHeavy: true }
    );
    const predictionResult = await enqueueBackgroundWork(
      'sync:default-predictions',
      () => applyDefaultPredictionsForLockedMatches(),
      { priority: 'normal', memoryHeavy: false, coalesceKey: 'sync:default-predictions' }
    );
    if (!predictionResult?.coalesced) {
      const { created, purgedAiDefaults } = predictionResult;
      if (created > 0) {
        console.log(`Default 0-0 predictions applied: ${created}`);
      }
      if (purgedAiDefaults > 0) {
        console.log(`AI default 0-0 purged on locked upcoming: ${purgedAiDefaults}`);
      }
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
