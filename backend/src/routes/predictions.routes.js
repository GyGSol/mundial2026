import { Router } from 'express';
import { Match } from '../models/Match.js';
import { Prediction } from '../models/Prediction.js';
import { Team } from '../models/Team.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { notifyMatchesUpdated } from '../services/websocketService.js';
import { isPredictionLocked } from '../services/predictionLockService.js';
import { computePredictedGroupStandings } from '../services/predictedGroupStandingsService.js';
import { annotateGroupQualification } from '../services/worldCupStatsService.js';
import { isGroupPhaseMatch } from '../services/groupStandingsUtils.js';

const router = Router();

router.get('/group-standings', authMiddleware, async (req, res, next) => {
  try {
    const groupFilter = req.query.group
      ? String(req.query.group).trim().toUpperCase()
      : null;

    const teams = await Team.find({ group: { $exists: true, $ne: '' } }).lean();
    const matches = await Match.find({ group: { $exists: true, $ne: '' } })
      .sort({ kickoffAt: 1 })
      .lean();

    const groupMatches = matches.filter(isGroupPhaseMatch);
    const matchIds = groupMatches.map((m) => m._id);

    const predictions = await Prediction.find({
      userId: req.user._id,
      matchId: { $in: matchIds },
    }).lean();

    const predictionsByMatchId = new Map(
      predictions.map((p) => [
        p.matchId.toString(),
        {
          homeGoals: p.homeGoals,
          awayGoals: p.awayGoals,
          userSubmitted: Boolean(p.userSubmitted),
        },
      ])
    );

    let groups = annotateGroupQualification(
      computePredictedGroupStandings(teams, groupMatches, predictionsByMatchId)
    );

    if (groupFilter) {
      groups = groups.filter((entry) => entry.group === groupFilter);
    }

    res.json({ groups });
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
