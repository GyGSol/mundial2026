import { env } from '../config/env.js';
import { runAiPredictionTick } from '../services/aiPredictionService.js';

let intervalId = null;
let running = false;

async function tick() {
  if (running) return;
  if (
    !env.aiPredictionsEnabled ||
    (!env.cerebrasApiKey && !env.googleAiApiKey && !env.groqApiKey)
  ) {
    return;
  }

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
  if (!env.cerebrasApiKey && !env.googleAiApiKey && !env.groqApiKey) {
    console.log(
      'AI predictions job disabled (CEREBRAS_API_KEY, GOOGLE_AI_API_KEY and GROQ_API_KEY not set)'
    );
    return;
  }

  tick();
  intervalId = setInterval(tick, env.aiPredictJobIntervalMs);
  const intervalSec = env.aiPredictJobIntervalMs / 1000;
  const leadMin = env.aiPredictLeadMs / 60000;
  console.log(
    `AI predictions job started (every ${intervalSec}s, T-${leadMin} min antes del kickoff)`
  );
}

export function stopAiPredictionsJob() {
  if (intervalId) clearInterval(intervalId);
  intervalId = null;
}
