import { Router } from 'express';
import { Match } from '../models/Match.js';
import { Team } from '../models/Team.js';
import { Stadium } from '../models/Stadium.js';
import { Prediction } from '../models/Prediction.js';
import { optionalAuth } from '../middleware/auth.middleware.js';
import {
  ensureDefaultPredictionsForUser,
  enrichMatchPredictionMeta,
} from '../services/predictionLockService.js';
import { getBroadcastersForMatch } from '../data/broadcastSchedule.js';

const router = Router();

async function enrichMatches(matches, userId) {
  if (userId) {
    await ensureDefaultPredictionsForUser(userId);
  }

  const teamIds = new Set();
  for (const m of matches) {
    teamIds.add(m.homeTeamId);
    teamIds.add(m.awayTeamId);
  }

  const teams = await Team.find({ externalId: { $in: [...teamIds] } });
  const teamMap = Object.fromEntries(teams.map((t) => [t.externalId, t]));

  const stadiumIds = [...new Set(matches.map((m) => m.stadiumId).filter(Boolean))];
  const stadiums = await Stadium.find({ externalId: { $in: stadiumIds } });
  const stadiumMap = Object.fromEntries(stadiums.map((s) => [s.externalId, s]));

  let predictionMap = {};
  if (userId) {
    const predictions = await Prediction.find({
      userId,
      matchId: { $in: matches.map((m) => m._id) },
    });
    predictionMap = Object.fromEntries(
      predictions.map((p) => [
        p.matchId.toString(),
        {
          homeGoals: p.homeGoals,
          awayGoals: p.awayGoals,
          userSubmitted: Boolean(p.userSubmitted),
          pointsEarned: p.pointsEarned,
          pointsBreakdown: p.pointsBreakdown,
        },
      ])
    );
  }

  return matches.map((m) => {
    const prediction = predictionMap[m._id.toString()] || null;
    const meta = enrichMatchPredictionMeta(m, prediction);

    return {
      id: m._id.toString(),
      externalId: m.externalId,
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      group: m.group,
      matchday: m.matchday,
      localDate: m.localDate,
      status: m.status,
      kickoffAt: m.kickoffAt,
      kickoffTimezone:
        m.kickoffTimezone || stadiumMap[m.stadiumId]?.timezone || null,
      lockAt: meta.lockAt,
      homeTeam: teamMap[m.homeTeamId]
        ? {
            nameEn: teamMap[m.homeTeamId].nameEn,
            fifaCode: teamMap[m.homeTeamId].fifaCode,
            flag: teamMap[m.homeTeamId].flag,
            externalId: teamMap[m.homeTeamId].externalId,
          }
        : null,
      awayTeam: teamMap[m.awayTeamId]
        ? {
            nameEn: teamMap[m.awayTeamId].nameEn,
            fifaCode: teamMap[m.awayTeamId].fifaCode,
            flag: teamMap[m.awayTeamId].flag,
            externalId: teamMap[m.awayTeamId].externalId,
          }
        : null,
      broadcasters: getBroadcastersForMatch(m.externalId, {
        homeTeam: teamMap[m.homeTeamId],
        awayTeam: teamMap[m.awayTeamId],
      }),
      stadium: stadiumMap[m.stadiumId]
        ? {
            nameEn: stadiumMap[m.stadiumId].nameEn,
            city: stadiumMap[m.stadiumId].city,
            country: stadiumMap[m.stadiumId].country,
          }
        : null,
      prediction,
      ...meta,
    };
  });
}

router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.group) filter.group = req.query.group;

    const matches = await Match.find(filter).sort({ kickoffAt: 1 });
    const enriched = await enrichMatches(matches, req.user?._id);
    res.json({ matches: enriched, total: enriched.length });
  } catch (err) {
    next(err);
  }
});

export default router;
