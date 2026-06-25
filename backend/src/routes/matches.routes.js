import { Router } from 'express';
import { Match } from '../models/Match.js';
import { authMiddleware, optionalAuth } from '../middleware/auth.middleware.js';
import { getMatchStreamConfig } from '../services/streamLinkService.js';
import {
  enrichMatchesFull,
  enrichMatchesLight,
  enrichMatchesForRankingDashboard,
  prepareFifaShirtMapsForMatches,
} from '../services/matchEnrichmentService.js';
import { attachStreamMetaToMatches } from '../services/streamMetaService.js';
import { sortMatchesBySchedule } from '../services/matchSortService.js';
import { getCachedLiveMatchSnapshot } from '../services/liveMatchSnapshotService.js';

const router = Router();

router.get('/live-snapshot', optionalAuth, async (req, res, next) => {
  try {
    const detailMatchId = req.query.detailMatchId
      ? String(req.query.detailMatchId)
      : undefined;
    const payload = await getCachedLiveMatchSnapshot(req.user?._id, detailMatchId);
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/stream', authMiddleware, async (req, res, next) => {
  try {
    const config = await getMatchStreamConfig(req.params.id, req.user._id, {
      sourceId: req.query.sourceId,
    });

    if (config.reason === 'not_found') {
      return res.status(404).json(config);
    }

    res.json(config);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const match = await Match.findById(req.params.id).lean();
    if (!match) {
      return res.status(404).json({ error: 'Partido no encontrado' });
    }

    await prepareFifaShirtMapsForMatches([match]);
    const enriched = await enrichMatchesForRankingDashboard([match], req.user?._id);
    const [withStream] = await attachStreamMetaToMatches(enriched);
    if (!withStream) {
      return res.status(404).json({ error: 'Partido no encontrado' });
    }

    res.json({ match: withStream });
  } catch (err) {
    next(err);
  }
});

router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.group) filter.group = req.query.group;

    const full = req.query.full === '1' || req.query.full === 'true';
    let query = Match.find(filter).sort({ kickoffAt: 1 });
    if (!full) {
      query = query.select('-raw');
    }

    const matches = sortMatchesBySchedule(await query.lean());
    await prepareFifaShirtMapsForMatches(matches);

    const enriched = full
      ? await enrichMatchesFull(matches, req.user?._id)
      : await enrichMatchesLight(matches, req.user?._id);

    res.json({ matches: enriched, total: enriched.length });
  } catch (err) {
    next(err);
  }
});

export default router;
