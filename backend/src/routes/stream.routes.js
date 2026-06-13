import { Router } from 'express';
import { optionalAuth } from '../middleware/auth.middleware.js';
import { getStreamConfig } from '../services/streamConfigService.js';

const router = Router();

router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const matchId = req.query.matchId;
    const channelId = req.query.channelId;

    const config = await getStreamConfig(matchId, channelId);

    if (!config.available) {
      const statusCode =
        config.reason === 'not_found' ? 404 : config.reason === 'invalid_channel' ? 400 : 200;
      return res.status(statusCode).json(config);
    }

    res.json(config);
  } catch (err) {
    next(err);
  }
});

export default router;
