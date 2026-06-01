import { Router } from 'express';
import { getLeaderboard } from '../services/leaderboardService.js';
import { getLastSyncAt } from '../services/syncService.js';
import { getCompetitionGroupById } from '../services/competitionGroupService.js';
import { optionalAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const groupId = req.query.groupId || null;

    if (!groupId) {
      const [leaderboard, lastSyncAt] = await Promise.all([
        getLeaderboard(null),
        getLastSyncAt(),
      ]);
      return res.json({
        leaderboard,
        group: null,
        lastSyncAt,
      });
    }

    const [leaderboard, lastSyncAt, group] = await Promise.all([
      getLeaderboard(groupId),
      getLastSyncAt(),
      getCompetitionGroupById(groupId),
    ]);

    if (!group) {
      return res.status(404).json({ error: 'Grupo no encontrado' });
    }

    res.json({ leaderboard, group, lastSyncAt });
  } catch (err) {
    next(err);
  }
});

export default router;
