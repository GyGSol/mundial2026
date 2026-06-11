import { promoteMatchesAtKickoff } from '../services/kickoffLiveService.js';
import { env } from '../config/env.js';

let intervalId = null;
let running = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    const promoted = await promoteMatchesAtKickoff();
    if (promoted.length > 0) {
      console.log(`Kickoff watch: ${promoted.length} partido(s) en vivo`);
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
