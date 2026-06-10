import { Router } from 'express';
import { Match } from '../models/Match.js';
import { Prediction } from '../models/Prediction.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { notifyMatchesUpdated } from '../services/websocketService.js';
import { isPredictionLocked } from '../services/predictionLockService.js';
import { backfillLegacyUserSubmittedPredictions } from '../services/predictionMigrationService.js';
import { buildUserPredictedMatchContext } from '../services/predictedMatchContextService.js';

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
