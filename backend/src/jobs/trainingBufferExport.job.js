import cron from 'node-cron';
import { env } from '../config/env.js';
import { exportTrainingBufferJob } from '../services/trainingBufferExportJob.js';

let scheduled = false;

export function startTrainingBufferExportJob() {
  if (scheduled || !env.trainingBufferExportCron) return;
  if (!cron.validate(env.trainingBufferExportCron)) {
    console.warn('Invalid TRAINING_BUFFER_EXPORT_CRON:', env.trainingBufferExportCron);
    return;
  }

  cron.schedule(env.trainingBufferExportCron, () => {
    exportTrainingBufferJob().catch((err) => {
      console.error('Training buffer export cron failed:', err.message);
    });
  });

  scheduled = true;
  console.log(`Training buffer export cron: ${env.trainingBufferExportCron}`);
}
