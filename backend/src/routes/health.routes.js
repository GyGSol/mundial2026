import { Router } from 'express';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { parseDatabaseName } from '../config/testDbGuard.js';
import { SyncMeta } from '../models/SyncMeta.js';
import { Match } from '../models/Match.js';
import { Team } from '../models/Team.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const meta = await SyncMeta.findOne({ key: 'global' });
    const [matchesCount, teamsCount] = await Promise.all([
      Match.countDocuments(),
      Team.countDocuments(),
    ]);

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
    });
  } catch (err) {
    next(err);
  }
});

export default router;
