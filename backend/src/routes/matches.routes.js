import { Router } from 'express';
import { Match } from '../models/Match.js';
import { optionalAuth } from '../middleware/auth.middleware.js';
import {
  enrichMatchesFull,
  enrichMatchesLight,
  prepareFifaShirtMapsForMatches,
} from '../services/matchEnrichmentService.js';

const router = Router();

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

    const matches = await query.lean();
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
