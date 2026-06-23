import { env } from '../config/env.js';
import { runPredictionLockReminderTick } from '../services/predictionLockReminderService.js';

let intervalId = null;
let running = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    const result = await runPredictionLockReminderTick();
    if (result.matches > 0) {
      console.log(
        `Prediction lock reminders: ${result.matches} partido(s), ${result.notifiedUsers} usuario(s), ${result.sent} push enviado(s)`
      );
    }
  } catch (err) {
    console.error('Prediction lock reminder error:', err.message);
  } finally {
    running = false;
  }
}

export function startPredictionLockReminderJob() {
  tick();
  intervalId = setInterval(tick, env.predictionLockReminderIntervalMs);
  const seconds = env.predictionLockReminderIntervalMs / 1000;
  console.log(`Prediction lock reminder job started (every ${seconds}s, 30 min before close)`);
}

export function stopPredictionLockReminderJob() {
  if (intervalId) clearInterval(intervalId);
  intervalId = null;
}
