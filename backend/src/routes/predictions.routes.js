import { Router } from 'express';
import { Match } from '../models/Match.js';
import { Prediction } from '../models/Prediction.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { notifyMatchesUpdated } from '../services/websocketService.js';
import { isPredictionLocked } from '../services/predictionLockService.js';

const router = Router();

router.put('/:matchId', authMiddleware, async (req, res, next) => {
  try {
    const { homeGoals, awayGoals } = req.body;
    const home = Number(homeGoals);
    const away = Number(awayGoals);

    if (!Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0) {
      return res.status(400).json({ error: 'Invalid score values' });
    }

    const match = await Match.findById(req.params.matchId);
    if (!match) return res.status(404).json({ error: 'Match not found' });

    if (isPredictionLocked(match)) {
      return res.status(400).json({
        error: 'Las predicciones cierran 1 hora antes del comienzo del partido',
      });
    }

    const prediction = await Prediction.findOneAndUpdate(
      { userId: req.user._id, matchId: match._id },
      { homeGoals: home, awayGoals: away, pointsEarned: null, pointsBreakdown: null },
      { upsert: true, new: true }
    );

    notifyMatchesUpdated({ reason: 'prediction_saved', matchId: match._id.toString() });

    res.json({
      prediction: {
        homeGoals: prediction.homeGoals,
        awayGoals: prediction.awayGoals,
        pointsEarned: prediction.pointsEarned,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
