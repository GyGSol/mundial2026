import { Match } from '../models/Match.js';
import { syncLiveMatchScoring } from '../services/kickoffLiveService.js';
import { env } from '../config/env.js';
import { findRecentlyFinishedMatchesQuery } from '../services/matchDisplayVisibilityService.js';
import { enqueueBackgroundWork } from '../services/backgroundWorkQueue.js';

const LIVE_INTERVAL_MS = Number(process.env.KICKOFF_WATCH_LIVE_MS || 15_000);

let timeoutId = null;
let running = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    const result = await enqueueBackgroundWork(
      'kickoff:live-scoring',
      () => syncLiveMatchScoring(),
      { priority: 'critical', memoryHeavy: true }
    );
    if (result.promoted > 0) {
      console.log(`Kickoff watch: ${result.promoted} partido(s) pasaron a en vivo`);
    }
    if (result.reopened > 0) {
      console.log(`Kickoff watch: ${result.reopened} partido(s) reabiertos desde finished`);
    }
    if (result.finalized > 0) {
      console.log(`Kickoff watch: ${result.finalized} partido(s) pasaron a finalizado`);
    }
    if (result.liveMatches > 0 && result.users > 0) {
      console.log(
        `Live scoring: ${result.liveMatches} partido(s), ${result.users} usuarios actualizados`
      );
    }
  } catch (err) {
    console.error('Kickoff watch error:', err.message);
  } finally {
    running = false;
  }
}

async function scheduleNext() {
  const hasLive = Boolean(await Match.exists({ status: 'live' }));
  const hasRecentFinished = Boolean(
    await Match.exists(findRecentlyFinishedMatchesQuery())
  );
  const delayMs =
    hasLive || hasRecentFinished ? LIVE_INTERVAL_MS : env.kickoffWatchIntervalMs;
  timeoutId = setTimeout(async () => {
    await tick();
    scheduleNext();
  }, delayMs);
}

export function startKickoffWatchJob() {
  void tick().then(() => scheduleNext());
  const idleSeconds = env.kickoffWatchIntervalMs / 1000;
  const liveSeconds = LIVE_INTERVAL_MS / 1000;
  console.log(`Kickoff watch started (adaptive ${liveSeconds}s live / ${idleSeconds}s idle)`);
}

export function stopKickoffWatchJob() {
  if (timeoutId) clearTimeout(timeoutId);
  timeoutId = null;
}
