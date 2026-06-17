import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { predictiveModelingAuth } from '../middleware/predictiveModelingAuth.middleware.js';
import { Match } from '../models/Match.js';
import {
  buildAiCompetitorPredictionContext,
  getAiUser,
} from '../services/aiPredictionService.js';
import { predictScore, predictLiveAdjustment } from '../services/predictiveModelingService.js';
import { applyCalibrationNudge } from '../services/aiPredictionCalibrationService.js';

const router = Router();

router.use(authMiddleware, predictiveModelingAuth);

/** Inferencia Oracle para el usuario Predictive Modeling. */
router.post('/predict/:matchId', async (req, res, next) => {
  try {
    const match = await Match.findById(req.params.matchId).lean();
    if (!match) return res.status(404).json({ error: 'Partido no encontrado' });

    const aiUser = await getAiUser();
    const context = await buildAiCompetitorPredictionContext(match, aiUser._id);
    const raw = await predictScore(context);
    const score = applyCalibrationNudge(raw, context._calibrationStats);

    res.json({
      matchId: match._id,
      predicted_score: [score.homeGoals, score.awayGoals],
      confidence_interval: raw.oracle?.confidence_interval ?? null,
      key_variable_impact: raw.oracle?.key_variable_impact ?? raw.reasoning ?? null,
      error_reduction_factor: raw.oracle?.error_reduction_factor ?? null,
      source: score.source ?? raw.source,
      calibrationApplied: Boolean(context._calibrationStats?.puedeAjustar),
    });
  } catch (err) {
    next(err);
  }
});

/** Ajuste en vivo mientras el partido está live. */
router.post('/live-adjust/:matchId', async (req, res, next) => {
  try {
    const match = await Match.findById(req.params.matchId).lean();
    if (!match) return res.status(404).json({ error: 'Partido no encontrado' });

    const result = await predictLiveAdjustment(match._id, {
      homeScore: req.body?.homeScore,
      awayScore: req.body?.awayScore,
      minute: req.body?.minute,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
