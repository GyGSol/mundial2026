import { Router } from 'express';
import { Match } from '../models/Match.js';
import { Team } from '../models/Team.js';
import { Group } from '../models/Group.js';
import { Stadium } from '../models/Stadium.js';
import { getLastSyncAt } from '../services/syncService.js';
import { buildWorldCupOverview } from '../services/worldCupStatsService.js';
import { buildMatchPredictionRankings } from '../services/matchPredictionRankingsService.js';
import { optionalAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const groupId =
      req.query.groupId ||
      req.user?.competitionGroupId?.toString?.() ||
      req.user?.competitionGroup?.id;

    const overview = await buildWorldCupOverview({
      Match,
      Team,
      Group,
      Stadium,
      getLastSyncAt,
      competitionGroupId: groupId || null,
      buildMatchPredictionRankings,
    });
    res.json(overview);
  } catch (err) {
    next(err);
  }
});

export default router;
