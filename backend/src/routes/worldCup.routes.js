import { Router } from 'express';
import { Match } from '../models/Match.js';
import { Team } from '../models/Team.js';
import { Group } from '../models/Group.js';
import { Stadium } from '../models/Stadium.js';
import { getLastSyncAt } from '../services/syncService.js';
import { buildWorldCupOverview } from '../services/worldCupStatsService.js';
import { buildWorldCupHistoryOverview } from '../services/worldCupHistoryService.js';
import {
  getWorldCupAiBriefing,
  refreshWorldCupAiBriefing,
} from '../services/aiWorldCupStatsService.js';
import { optionalAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/history', async (_req, res, next) => {
  try {
    const history = await buildWorldCupHistoryOverview();
    res.json(history);
  } catch (err) {
    next(err);
  }
});

router.get('/ai-briefing', optionalAuth, async (req, res, next) => {
  try {
    const refresh = req.query.refresh === '1' || req.query.refresh === 'true';
    const payload = refresh
      ? await refreshWorldCupAiBriefing()
      : await getWorldCupAiBriefing();
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

router.post('/ai-briefing/refresh', optionalAuth, async (_req, res, next) => {
  try {
    const payload = await refreshWorldCupAiBriefing();
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const overview = await buildWorldCupOverview({
      Match,
      Team,
      Group,
      Stadium,
      getLastSyncAt,
    });
    res.json(overview);
  } catch (err) {
    next(err);
  }
});

export default router;
