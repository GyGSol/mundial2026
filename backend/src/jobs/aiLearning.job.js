import cron from 'node-cron';
import { env } from '../config/env.js';
import { processAiLearningQueueBatch } from '../services/aiLearningQueueService.js';

let scheduled = false;
let running = false;

export async function runAiLearningQueueJob() {
  if (running) return { skipped: true, reason: 'already_running' };
  running = true;
  try {
    return await processAiLearningQueueBatch({
      limit: env.aiLearningJobBatchSize,
      interStepDelayMs: env.cerebrasMinGapMs,
    });
  } finally {
    running = false;
  }
}

export function startAiLearningJob() {
  if (scheduled || !env.aiLearningJobCron) return;
  if (!cron.validate(env.aiLearningJobCron)) {
    console.warn('Invalid AI_LEARNING_JOB_CRON:', env.aiLearningJobCron);
    return;
  }

  cron.schedule(env.aiLearningJobCron, () => {
    runAiLearningQueueJob().catch((err) => {
      console.error('AI learning queue cron failed:', err.message);
    });
  });

  scheduled = true;
  console.log(`AI learning queue cron: ${env.aiLearningJobCron}`);
}
