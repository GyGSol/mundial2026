import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Prediction } from '../models/Prediction.js';
import { getCompetitionGroupById } from './competitionGroupService.js';
import { compareRankingEntries } from './leaderboardService.js';
import { calculateGoalDiff } from './scoringService.js';
import { recalculateMatchScores } from './syncService.js';

function breakdownHits(breakdown) {
  if (!breakdown) return { pa: 0, gl: 0, gv: 0, gt: 0 };
  return {
    pa: breakdown.winner > 0 ? 1 : 0,
    gl: breakdown.homeGoals > 0 ? 1 : 0,
    gv: breakdown.awayGoals > 0 ? 1 : 0,
    gt: breakdown.totalGoals > 0 ? 1 : 0,
  };
}

export function rankMatchPredictions(predictions, userMap, { onlyScorers = true, actual = null } = {}) {
  const rows = predictions
    .filter((prediction) => prediction.pointsEarned != null)
    .map((prediction) => {
      const userId = prediction.userId.toString();
      const hits = breakdownHits(prediction.pointsBreakdown);
      const bonusPoint = prediction.bonusPoint ?? 0;
      const basePoints = prediction.pointsEarned ?? 0;
      const predicted = { home: prediction.homeGoals, away: prediction.awayGoals };
      const goalDiff =
        prediction.goalDiffHome != null && prediction.goalDiffAway != null
          ? { home: prediction.goalDiffHome, away: prediction.goalDiffAway }
          : actual
            ? calculateGoalDiff(predicted, actual)
            : { home: 0, away: 0 };
      return {
        id: userId,
        name: userMap[userId] || 'Jugador',
        points: basePoints + bonusPoint,
        basePoints,
        pb: bonusPoint,
        bonusReason: prediction.bonusReason ?? null,
        difGl: goalDiff.home,
        difGv: goalDiff.away,
        pj: 1,
        ...hits,
      };
    })
    .filter((row) => !onlyScorers || row.points > 0)
    .sort(compareRankingEntries);

  return rows.map((row, index) => ({
    ...row,
    rank: index + 1,
  }));
}

async function rescoreUnscoredPredictions(finishedMatches = []) {
  for (const match of finishedMatches) {
    const unscored = await Prediction.countDocuments({
      matchId: match._id,
      pointsEarned: null,
    });
    if (unscored > 0) {
      await recalculateMatchScores(match._id);
    }
  }
}

export async function buildMatchPredictionRankings(competitionGroupId, finishedMatches = []) {
  if (!competitionGroupId) {
    return { group: null, rankingsByMatch: {} };
  }

  const group = await getCompetitionGroupById(competitionGroupId);
  if (!group) {
    return { group: null, rankingsByMatch: {} };
  }

  const users = await User.find({
    competitionGroupId: new mongoose.Types.ObjectId(competitionGroupId),
  })
    .sort({ name: 1 })
    .select('name');

  if (!users.length || !finishedMatches.length) {
    return { group, rankingsByMatch: {} };
  }

  const userMap = Object.fromEntries(users.map((user) => [user._id.toString(), user.name]));
  const userIds = users.map((user) => user._id);
  const matchIds = finishedMatches.map((match) => match._id);

  await rescoreUnscoredPredictions(finishedMatches);

  const predictions = await Prediction.find({
    userId: { $in: userIds },
    matchId: { $in: matchIds },
    pointsEarned: { $ne: null },
  });

  const predictionsByMatch = new Map();
  for (const prediction of predictions) {
    const key = prediction.matchId.toString();
    if (!predictionsByMatch.has(key)) predictionsByMatch.set(key, []);
    predictionsByMatch.get(key).push(prediction);
  }

  const rankingsByMatch = {};
  for (const match of finishedMatches) {
    const matchPredictions = predictionsByMatch.get(match._id.toString()) || [];
    if (!matchPredictions.length) continue;
    rankingsByMatch[match.externalId] = rankMatchPredictions(matchPredictions, userMap, {
      actual: { home: match.homeScore ?? 0, away: match.awayScore ?? 0 },
    });
  }

  return { group, rankingsByMatch };
}
