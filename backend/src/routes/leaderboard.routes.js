import { Router } from 'express';
import { getLeaderboard } from '../services/leaderboardService.js';
import { getLastSyncAt } from '../services/syncService.js';
import { getCompetitionGroupById } from '../services/competitionGroupService.js';
import { getCachedRankingDashboard, getCachedRankingDashboardShellOnly } from '../services/rankingDashboardCache.js';
import { getLeaderboardPointsEvolutionRaw, getLeaderboardPointsEvolution } from '../services/leaderboardPointsEvolutionService.js';
import { getRankingFinishedArchive } from '../services/rankingDashboardService.js';
import { optionalAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/dashboard/shell', optionalAuth, async (req, res, next) => {
  try {
    const groupId = req.query.groupId || null;
    if (!groupId) {
      return res.status(400).json({ error: 'groupId es obligatorio' });
    }

    const payload = await getCachedRankingDashboardShellOnly(groupId, req.user?._id);
    if (payload.notFound) {
      return res.status(404).json({ error: 'Grupo no encontrado' });
    }

    res.json(payload);
  } catch (err) {
    next(err);
  }
});

router.get('/dashboard', optionalAuth, async (req, res, next) => {
  try {
    const groupId = req.query.groupId || null;
    if (!groupId) {
      return res.status(400).json({ error: 'groupId es obligatorio' });
    }

    const detailMatchId = req.query.detailMatchId
      ? String(req.query.detailMatchId)
      : undefined;
    const payload = await getCachedRankingDashboard(groupId, req.user?._id, detailMatchId);
    if (payload.notFound) {
      return res.status(404).json({ error: 'Grupo no encontrado' });
    }

    res.json(payload);
  } catch (err) {
    next(err);
  }
});

router.get('/finished-archive', optionalAuth, async (req, res, next) => {
  try {
    res.json(await getRankingFinishedArchive());
  } catch (err) {
    next(err);
  }
});

router.get('/:groupId/points-evolution/raw', optionalAuth, async (req, res, next) => {
  try {
    const { groupId } = req.params;
    if (!groupId) {
      return res.status(400).json({ error: 'groupId es obligatorio' });
    }

    const payload = await getLeaderboardPointsEvolutionRaw(groupId);
    if (payload.notFound) {
      return res.status(404).json({ error: 'Grupo no encontrado' });
    }

    res.json(payload);
  } catch (err) {
    next(err);
  }
});

router.get('/:groupId/points-evolution', optionalAuth, async (req, res, next) => {
  try {
    const { groupId } = req.params;
    if (!groupId) {
      return res.status(400).json({ error: 'groupId es obligatorio' });
    }

    const payload = await getLeaderboardPointsEvolution(groupId);
    if (payload.notFound) {
      return res.status(404).json({ error: 'Grupo no encontrado' });
    }

    res.json(payload);
  } catch (err) {
    next(err);
  }
});

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

    if (groupId === '__nogroup') {
      const [leaderboard, lastSyncAt] = await Promise.all([
        getLeaderboard('__nogroup'),
        getLastSyncAt(),
      ]);
      return res.json({
        leaderboard,
        group: { id: '__nogroup', name: 'Sin grupo' },
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
