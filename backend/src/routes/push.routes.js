import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import {
  getVapidPublicKey,
  savePushSubscription,
} from '../services/pushNotificationService.js';

const router = Router();

router.get('/vapid-public-key', (_req, res) => {
  const publicKey = getVapidPublicKey();
  res.json({
    enabled: Boolean(publicKey),
    publicKey,
  });
});

router.post('/subscribe', authMiddleware, async (req, res, next) => {
  try {
    await savePushSubscription(req.user._id, req.body?.subscription);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
