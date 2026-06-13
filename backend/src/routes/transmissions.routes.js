import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { listTodayTransmissions } from '../services/transmissionService.js';

const router = Router();

router.get('/today', authMiddleware, async (req, res, next) => {
  try {
    const payload = await listTodayTransmissions(req.user._id);
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

export default router;
