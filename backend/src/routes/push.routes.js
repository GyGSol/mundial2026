import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import {
  getVapidPublicKey,
  savePushSubscription,
  getPushPreferencesForUser,
  updatePushPreferencesForUser,
} from '../services/pushNotificationService.js';

const router = Router();

router.get('/vapid-public-key', (_req, res) => {
  const publicKey = getVapidPublicKey();
  res.json({
    enabled: Boolean(publicKey),
    publicKey,
  });
});

router.get('/preferences', authMiddleware, async (req, res, next) => {
  try {
    const data = await getPushPreferencesForUser(req.user._id);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.patch('/preferences', authMiddleware, async (req, res, next) => {
  try {
    const data = await updatePushPreferencesForUser(req.user._id, req.body ?? {});
    res.json(data);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
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
