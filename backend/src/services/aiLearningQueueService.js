import { AiLearningJob } from '../models/AiLearningJob.js';
import { Match } from '../models/Match.js';
import { getOrGenerateAiPostMatchReview } from './aiPostMatchLearningService.js';
import {
  recordValidationError,
  replayOracleLearningForMatch,
} from './trainingBufferService.js';

const DEFAULT_STEPS = ['postMatchReview', 'shadowReplay'];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function enqueueAiLearningForMatch(matchId, { steps = DEFAULT_STEPS, delayMs = 120_000 } = {}) {
  const match = await Match.findById(matchId).select('_id status').lean();
  if (!match || match.status !== 'finished') {
    return { enqueued: false, reason: 'not_finished' };
  }

  const nextRunAt = new Date(Date.now() + Math.max(0, delayMs));
  const doc = await AiLearningJob.findOneAndUpdate(
    { matchId: match._id, status: { $in: ['pending', 'processing', 'failed'] } },
    {
      $setOnInsert: { matchId: match._id, steps, completedSteps: [] },
      $set: { status: 'pending', nextRunAt, lastError: null },
    },
    { upsert: true, new: true }
  );

  return { enqueued: true, id: doc._id, nextRunAt: doc.nextRunAt };
}

async function runStep(matchId, step, { force = false } = {}) {
  if (step === 'postMatchReview') {
    await getOrGenerateAiPostMatchReview(matchId);
    return { ok: true };
  }
  if (step === 'shadowReplay') {
    const result = await replayOracleLearningForMatch(matchId, { force });
    if (result.replayed) return { ok: true, result };
    if (result.reason === 'already_replayed') return { ok: true, skipped: true };
    return { ok: false, reason: result.reason ?? 'replay_failed' };
  }
  return { ok: false, reason: 'unknown_step' };
}

export async function processAiLearningJob(job, { interStepDelayMs = 0 } = {}) {
  const match = await Match.findById(job.matchId).lean();
  if (!match || match.status !== 'finished') {
    await AiLearningJob.updateOne(
      { _id: job._id },
      { $set: { status: 'failed', lastError: 'match_not_finished', finishedAt: new Date() } }
    );
    return { processed: false, reason: 'match_not_finished' };
  }

  await recordValidationError(match._id);

  const completed = new Set(job.completedSteps ?? []);
  const pendingSteps = (job.steps ?? DEFAULT_STEPS).filter((s) => !completed.has(s));

  for (const step of pendingSteps) {
    const stepResult = await runStep(match._id, step);
    if (!stepResult.ok) {
      await AiLearningJob.updateOne(
        { _id: job._id },
        {
          $set: {
            status: 'failed',
            lastError: stepResult.reason,
            attempts: (job.attempts ?? 0) + 1,
            nextRunAt: new Date(Date.now() + 15 * 60 * 1000),
          },
        }
      );
      return { processed: false, failedStep: step, reason: stepResult.reason };
    }
    completed.add(step);
    await AiLearningJob.updateOne(
      { _id: job._id },
      { $set: { completedSteps: [...completed] } }
    );
    if (interStepDelayMs > 0) {
      await sleep(interStepDelayMs);
    }
  }

  await AiLearningJob.updateOne(
    { _id: job._id },
    { $set: { status: 'done', finishedAt: new Date(), lastError: null } }
  );
  return { processed: true, matchId: match._id.toString() };
}

export async function processAiLearningQueueBatch({
  limit = 1,
  interStepDelayMs = 3000,
} = {}) {
  const now = new Date();
  const jobs = await AiLearningJob.find({
    status: { $in: ['pending', 'failed'] },
    nextRunAt: { $lte: now },
  })
    .sort({ nextRunAt: 1 })
    .limit(Math.max(1, limit));

  const results = [];
  for (const job of jobs) {
    await AiLearningJob.updateOne({ _id: job._id }, { $set: { status: 'processing' } });
    try {
      const result = await processAiLearningJob(job, { interStepDelayMs });
      results.push({ jobId: job._id.toString(), ...result });
    } catch (err) {
      await AiLearningJob.updateOne(
        { _id: job._id },
        {
          $set: {
            status: 'failed',
            lastError: err.message,
            nextRunAt: new Date(Date.now() + 15 * 60 * 1000),
          },
          $inc: { attempts: 1 },
        }
      );
      results.push({ jobId: job._id.toString(), processed: false, error: err.message });
    }
  }

  return { count: results.length, results };
}

export async function getAiLearningQueueSummary() {
  const [pending, failed, done] = await Promise.all([
    AiLearningJob.countDocuments({ status: 'pending' }),
    AiLearningJob.countDocuments({ status: 'failed' }),
    AiLearningJob.countDocuments({ status: 'done' }),
  ]);
  return { pending, failed, done };
}
