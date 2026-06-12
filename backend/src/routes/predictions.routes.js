import { Router } from 'express';
import { Match } from '../models/Match.js';
import { Prediction } from '../models/Prediction.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { notifyMatchesUpdated } from '../services/websocketService.js';
import { isPredictionLocked } from '../services/predictionLockService.js';
import { backfillLegacyUserSubmittedPredictions } from '../services/predictionMigrationService.js';
import { buildUserPredictedMatchContext } from '../services/predictedMatchContextService.js';
import {
  askMatchAiFollowUp,
  getMatchAiInsightForUser,
  hasAiProvider,
} from '../services/aiPredictionService.js';

const router = Router();

router.get('/group-standings', authMiddleware, async (req, res, next) => {
  try {
    await backfillLegacyUserSubmittedPredictions();
    const groupFilter = req.query.group
      ? String(req.query.group).trim().toUpperCase()
      : null;

    const ctx = await buildUserPredictedMatchContext(req.user._id);
    const { teams, thirdPlaceRanked, knockout } = ctx;
    let groups = ctx.groups;

    if (groupFilter) {
      groups = groups.filter((entry) => entry.group === groupFilter);
    }

    res.json({
      groups,
      thirdPlaceStandings: {
        ranked: thirdPlaceRanked.ranked,
        provisional: thirdPlaceRanked.provisional,
        combinationKey: thirdPlaceRanked.combinationKey,
      },
      teams: teams.map((team) => ({
        externalId: team.externalId,
        nameEn: team.nameEn,
        nameFa: team.nameFa,
        fifaCode: team.fifaCode,
        group: team.group,
        flag: team.flag,
      })),
      knockout: {
        phases: knockout.phases,
        progress: knockout.progress,
        thirdPlaceCombinationKey: knockout.thirdPlaceCombinationKey,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:matchId/ai-insight', authMiddleware, async (req, res, next) => {
  try {
    if (!hasAiProvider()) {
      return res.status(503).json({ error: 'La IA no está configurada en el servidor' });
    }

    const insight = await getMatchAiInsightForUser(req.params.matchId, req.user._id);
    res.json({ insight });
  } catch (err) {
    if (err.message === 'Match not found') {
      return res.status(404).json({ error: 'Partido no encontrado' });
    }
    if (err.message === 'La consulta IA solo está disponible para partidos próximos') {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

router.post('/:matchId/ai-follow-up', authMiddleware, async (req, res, next) => {
  try {
    if (!hasAiProvider()) {
      return res.status(503).json({ error: 'La IA no está configurada en el servidor' });
    }

    const reply = await askMatchAiFollowUp(req.params.matchId, req.user._id, {
      question: req.body?.question,
      history: req.body?.history,
      insight: req.body?.insight,
    });
    res.json({ reply });
  } catch (err) {
    if (err.message === 'Match not found') {
      return res.status(404).json({ error: 'Partido no encontrado' });
    }
    if (
      err.message === 'Escribí una pregunta' ||
      err.message === 'La pregunta es demasiado larga' ||
      err.message === 'Predicción IA inválida' ||
      err.message === 'La consulta IA solo está disponible para partidos próximos'
    ) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

router.put('/:matchId', authMiddleware, async (req, res, next) => {
  try {
    const { homeGoals, awayGoals } = req.body;
    const home = Number(homeGoals);
    const away = Number(awayGoals);

    const maxGoals = 10;
    if (
      !Number.isInteger(home) ||
      !Number.isInteger(away) ||
      home < 0 ||
      away < 0 ||
      home > maxGoals ||
      away > maxGoals
    ) {
      return res.status(400).json({ error: `Marcá entre 0 y ${maxGoals} goles por equipo` });
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
      {
        homeGoals: home,
        awayGoals: away,
        userSubmitted: true,
        pointsEarned: null,
        pointsBreakdown: null,
      },
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
