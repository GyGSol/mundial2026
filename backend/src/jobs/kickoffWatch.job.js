import { syncLiveMatchScoring } from '../services/kickoffLiveService.js';
import { env } from '../config/env.js';

let intervalId = null;
let running = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    const result = await syncLiveMatchScoring();
    if (result.promoted > 0) {
      console.log(`Kickoff watch: ${result.promoted} partido(s) pasaron a en vivo`);
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

export function startKickoffWatchJob() {
  tick();
  intervalId = setInterval(tick, env.kickoffWatchIntervalMs);
  const seconds = env.kickoffWatchIntervalMs / 1000;
  console.log(`Kickoff watch started (every ${seconds}s)`);
}

export function stopKickoffWatchJob() {
  if (intervalId) clearInterval(intervalId);
}
