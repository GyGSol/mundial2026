import { Router } from 'express';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { parseDatabaseName } from '../config/testDbGuard.js';
import { SyncMeta } from '../models/SyncMeta.js';
import { Match } from '../models/Match.js';
import { Team } from '../models/Team.js';
import { getMemorySnapshot } from '../services/memoryBudgetService.js';
import { getBackgroundWorkQueueStats } from '../services/backgroundWorkQueue.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const meta = await SyncMeta.findOne({ key: 'global' });
    const [matchesCount, teamsCount] = await Promise.all([
      Match.countDocuments(),
      Team.countDocuments(),
    ]);
    const memory = getMemorySnapshot();
    const queueStats = getBackgroundWorkQueueStats();

    res.json({
      status: 'ok',
      environment: env.appEnv,
      databaseName: parseDatabaseName(env.mongodbUri),
      isLocalQa: env.appEnv === 'local-qa',
      db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      matchesCount,
      teamsCount,
      lastSyncAt: meta?.lastSyncAt ?? null,
      lastSyncError: meta?.lastSyncError ?? null,
      memory: {
        heapUsedMb: memory.heapUsedMb,
        heapLimitMb: memory.heapLimitMb,
        level: memory.level,
      },
      backgroundQueue: {
        pending: queueStats.pending,
        running: queueStats.running,
        deferred: queueStats.deferred,
        skipped: queueStats.skipped,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
