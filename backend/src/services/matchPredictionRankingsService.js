import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Prediction } from '../models/Prediction.js';
import { getCompetitionGroupById } from './competitionGroupService.js';
import { compareRankingEntries } from './leaderboardService.js';
import { compareAvgGoalDiff, compareGoalDiffScore } from './goalDiffStats.js';
import { calculateGoalDiff, calculatePoints } from './scoringService.js';
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

function emptyPredictionForUser(userId) {
  return {
    userId,
    pointsEarned: 0,
    pointsBreakdown: { winner: 0, homeGoals: 0, awayGoals: 0, totalGoals: 0 },
    bonusPoint: 0,
    homeGoals: 0,
    awayGoals: 0,
    goalDiffHome: null,
    goalDiffAway: null,
  };
}

function resolveGoalDiff(prediction, actual) {
  if (prediction.goalDiffHome != null && prediction.goalDiffAway != null) {
    return { home: prediction.goalDiffHome, away: prediction.goalDiffAway };
  }
  return calculateGoalDiff(
    { home: prediction.homeGoals ?? 0, away: prediction.awayGoals ?? 0 },
    actual
  );
}

/** Desempate elimination: con 0 pts en todos, Gdif (menor error) define el orden. */
export function compareEliminationRoundRank(a, b) {
  const pointsA = a.points ?? 0;
  const pointsB = b.points ?? 0;
  if (pointsB !== pointsA) return pointsB - pointsA;

  if (pointsA === 0 && pointsB === 0) {
    const gdifCmp = compareGoalDiffScore(a.difGl, a.difGv, a.pj, b.difGl, b.difGv, b.pj);
    if (gdifCmp !== 0) return gdifCmp;
    const difLocalCmp = compareAvgGoalDiff(a.difGl, a.pj, b.difGl, b.pj);
    if (difLocalCmp !== 0) return difLocalCmp;
    const difVisitCmp = compareAvgGoalDiff(a.difGv, a.pj, b.difGv, b.pj);
    if (difVisitCmp !== 0) return difVisitCmp;
    return a.name.localeCompare(b.name, 'es');
  }

  return compareRankingEntries(a, b);
}

function scorePredictionForMatch(prediction, match, { zeroPoints = false } = {}) {
  const predicted = { home: prediction.homeGoals ?? 0, away: prediction.awayGoals ?? 0 };
  const hasActual = match.status === 'live' || match.status === 'finished';
  const actual = hasActual
    ? { home: match.homeScore ?? 0, away: match.awayScore ?? 0 }
    : { home: 0, away: 0 };

  const goalDiff = resolveGoalDiff(prediction, actual);
  const hits = hasActual && !zeroPoints
    ? breakdownHits(calculatePoints(predicted, actual).breakdown)
    : { pa: 0, gl: 0, gv: 0, gt: 0 };

  let points = 0;
  let pb = 0;
  if (!zeroPoints && hasActual) {
    if (match.status === 'finished' && prediction.pointsEarned != null) {
      points = (prediction.pointsEarned ?? 0) + (prediction.bonusPoint ?? 0);
      pb = prediction.bonusPoint ?? 0;
      const storedHits = breakdownHits(prediction.pointsBreakdown);
      return {
        points,
        pb,
        pj: 1,
        pa: storedHits.pa,
        gl: storedHits.gl,
        gv: storedHits.gv,
        gt: storedHits.gt,
        difGl: goalDiff.home,
        difGv: goalDiff.away,
        bonusReason: prediction.bonusReason ?? null,
      };
    }
    const scored = calculatePoints(predicted, actual);
    pb = prediction.bonusPoint ?? 0;
    points = scored.total + pb;
    return {
      points,
      pb,
      pj: 1,
      ...hits,
      difGl: goalDiff.home,
      difGv: goalDiff.away,
      bonusReason: prediction.bonusReason ?? null,
    };
  }

  return {
    points: 0,
    pb: 0,
    pj: 1,
    pa: 0,
    gl: 0,
    gv: 0,
    gt: 0,
    difGl: goalDiff.home,
    difGv: goalDiff.away,
    bonusReason: null,
  };
}

export function rankActivePlayersForMatchBatch({
  activeUserIds,
  matches,
  predictionsByUserIdAndMatchId,
  userMap,
  zeroPoints = false,
}) {
  if (!matches?.length || !activeUserIds?.length) return [];

  const rows = activeUserIds.map((userId) => {
    const key = userId.toString();
    const aggregate = {
      id: key,
      name: userMap[key] || 'Jugador',
      points: 0,
      pb: 0,
      pj: 0,
      pa: 0,
      gl: 0,
      gv: 0,
      gt: 0,
      difGl: 0,
      difGv: 0,
      bonusReason: null,
    };

    for (const match of matches) {
      const matchKey = match._id?.toString?.() ?? String(match._id);
      const prediction =
        predictionsByUserIdAndMatchId.get(`${key}:${matchKey}`) ??
        emptyPredictionForUser(userId);
      const slice = scorePredictionForMatch(prediction, match, { zeroPoints });
      aggregate.points += slice.points;
      aggregate.pb += slice.pb;
      aggregate.pj += slice.pj;
      aggregate.pa += slice.pa;
      aggregate.gl += slice.gl;
      aggregate.gv += slice.gv;
      aggregate.gt += slice.gt;
      aggregate.difGl += slice.difGl;
      aggregate.difGv += slice.difGv;
    }

    return aggregate;
  });

  const sortFn =
    zeroPoints || rows.every((row) => (row.points ?? 0) === 0)
      ? compareEliminationRoundRank
      : compareRankingEntries;
  return rows.sort(sortFn).map((row, index) => ({
    ...row,
    rank: index + 1,
  }));
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

export function rankActivePlayersForMatch({
  activeUserIds,
  predictionsByUserId,
  userMap,
  actual = null,
}) {
  const predictions = activeUserIds.map((userId) => {
    const key = userId.toString();
    const prediction = predictionsByUserId.get(key);
    if (prediction) return prediction;
    return emptyPredictionForUser(userId);
  });

  return rankMatchPredictions(predictions, userMap, {
    onlyScorers: false,
    actual,
  });
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
