import { Router } from 'express';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { decodeAvatarDataUrl } from '../services/userAvatarService.js';

const router = Router();

router.get('/:userId/avatar', async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(404).end();
    }

    const user = await User.findById(userId).select('avatarDataUrl').lean();
    const parsed = decodeAvatarDataUrl(user?.avatarDataUrl);
    if (!parsed) {
      return res.status(404).end();
    }

    res.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    res.type(parsed.contentType).send(parsed.buffer);
  } catch (err) {
    next(err);
  }
});

export default router;
