import { env } from '../config/env.js';
import { runAiPredictionTick } from '../services/aiPredictionService.js';

let intervalId = null;
let running = false;

async function tick() {
  if (running) return;
  if (!env.aiPredictionsEnabled || (!env.googleAiApiKey && !env.groqApiKey)) return;

  running = true;
  try {
    const result = await runAiPredictionTick();
    if (result.processed > 0) {
      console.log(`AI predictions job: ${result.processed} partido(s) procesado(s)`);
    }
    if (result.errors?.length) {
      console.warn('AI predictions job errors:', result.errors.join('; '));
    }
  } catch (err) {
    console.error('AI predictions job error:', err.message);
  } finally {
    running = false;
  }
}

export function startAiPredictionsJob() {
  if (!env.aiPredictionsEnabled) {
    console.log('AI predictions job disabled (AI_PREDICTIONS_ENABLED=false)');
    return;
  }
  if (!env.googleAiApiKey && !env.groqApiKey) {
    console.log('AI predictions job disabled (GOOGLE_AI_API_KEY and GROQ_API_KEY not set)');
    return;
  }

  tick();
  intervalId = setInterval(tick, env.aiPredictJobIntervalMs);
  const minutes = env.aiPredictJobIntervalMs / 60000;
  console.log(`AI predictions job started (every ${minutes} min, lead ${env.aiPredictLeadMs / 60000} min before kickoff)`);
}

export function stopAiPredictionsJob() {
  if (intervalId) clearInterval(intervalId);
  intervalId = null;
}
