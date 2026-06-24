import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Match } from '../models/Match.js';
import { Prediction } from '../models/Prediction.js';
import { UserGroupMembership } from '../models/UserGroupMembership.js';
import { resolvePublicAvatarUrl } from './userAvatarService.js';
import { CompetitionGroup } from '../models/CompetitionGroup.js';
import { calculatePoints, calculateGoalDiff } from './scoringService.js';
import { compareAvgGoalDiff, compareGoalDiffScore } from './goalDiffStats.js';

function goalDiffHomeExpr(matchScoreField = '$matchDoc.homeScore') {
  return {
    $cond: [
      { $ne: ['$goalDiffHome', null] },
      '$goalDiffHome',
      { $abs: { $subtract: [{ $ifNull: [matchScoreField, 0] }, '$homeGoals'] } },
    ],
  };
}

function goalDiffAwayExpr(matchScoreField = '$matchDoc.awayScore') {
  return {
    $cond: [
      { $ne: ['$goalDiffAway', null] },
      '$goalDiffAway',
      { $abs: { $subtract: [{ $ifNull: [matchScoreField, 0] }, '$awayGoals'] } },
    ],
  };
}

const PREDICTION_MATCH_LOOKUP = {
  $lookup: {
    from: 'matches',
    localField: 'matchId',
    foreignField: '_id',
    as: 'matchDoc',
  },
};

function emptyStats() {
  return { pj: 0, pa: 0, gl: 0, gv: 0, gt: 0, pb: 0, difGl: 0, difGv: 0, totalPoints: 0 };
}

export function createEmptyLeaderboardStats() {
  return emptyStats();
}

export function accumulateLeaderboardStats(stats, breakdown, pointsEarned, bonusPoint = 0, goalDiff = null) {
  stats.pj += 1;
  if ((breakdown?.winner ?? 0) > 0) stats.pa += 1;
  if ((breakdown?.homeGoals ?? 0) > 0) stats.gl += 1;
  if ((breakdown?.awayGoals ?? 0) > 0) stats.gv += 1;
  if ((breakdown?.totalGoals ?? 0) > 0) stats.gt += 1;
  stats.pb += bonusPoint ?? 0;
  stats.difGl += goalDiff?.home ?? 0;
  stats.difGv += goalDiff?.away ?? 0;
  stats.totalPoints += (pointsEarned ?? 0) + (bonusPoint ?? 0);
}

/** En baseline de flechas: al kickoff 0-0 solo cuenta PA; GL/GV/GT se marcan al cambiar el marcador. */
export function breakdownForLiveKickoffIndicators(breakdown) {
  return {
    winner: breakdown?.winner ?? 0,
    homeGoals: 0,
    awayGoals: 0,
    totalGoals: 0,
  };
}

const LIVE_INDICATOR_STAT_KEYS = ['pa', 'gl', 'gv', 'gt', 'pb'];

function statCreditFromBreakdown(key, breakdown, bonusPoint = 0) {
  switch (key) {
    case 'pa':
      return (breakdown?.winner ?? 0) > 0 ? 1 : 0;
    case 'gl':
      return (breakdown?.homeGoals ?? 0) > 0 ? 1 : 0;
    case 'gv':
      return (breakdown?.awayGoals ?? 0) > 0 ? 1 : 0;
    case 'gt':
      return (breakdown?.totalGoals ?? 0) > 0 ? 1 : 0;
    case 'pb':
      return (bonusPoint ?? 0) > 0 ? 1 : 0;
    default:
      return 0;
  }
}

function resolveKickoffBreakdownSnapshot(prediction) {
  if (prediction.liveKickoffBreakdown) {
    return prediction.liveKickoffBreakdown;
  }
  const kickoff = calculatePoints(
    { home: prediction.homeGoals, away: prediction.awayGoals },
    { home: 0, away: 0 }
  );
  return kickoff.breakdown;
}

/** Baseline agregado del ranking: al kickoff 0-0 solo PA; GL/GV/GT cuentan al cambiar el marcador. */
function resolveKickoffIndicatorBreakdown(prediction) {
  return breakdownForLiveKickoffIndicators(resolveKickoffBreakdownSnapshot(prediction));
}

function goalStatCreditsCredited(breakdown) {
  return (
    statCreditFromBreakdown('gl', breakdown) > 0 &&
    statCreditFromBreakdown('gv', breakdown) > 0 &&
    statCreditFromBreakdown('gt', breakdown) > 0
  );
}

function isScoreStillNil(match) {
  return (match?.homeScore ?? 0) === 0 && (match?.awayScore ?? 0) === 0;
}

/**
 * Crédito de kickoff para flechas por partido.
 * GL siempre contra baseline sin goles; GV/GT en 0-0 muestran flecha si hay crédito,
 * pero no si el visitante/total ya estaba acertado al kickoff y el marcador avanzó (1-0).
 */
function resolveKickoffStatCreditForIndicator(key, prediction, kickoffBonus = 0, match = null) {
  const kickoffBreakdown = resolveKickoffBreakdownSnapshot(prediction);
  const currentBreakdown = prediction.pointsBreakdown ?? {};
  const rawCredit = statCreditFromBreakdown(key, kickoffBreakdown, kickoffBonus);
  const currentCredit = statCreditFromBreakdown(
    key,
    currentBreakdown,
    prediction.bonusPoint ?? 0
  );
  const scoreUnchanged = isScoreStillNil(match);

  if (key === 'gl') {
    return statCreditFromBreakdown(
      key,
      breakdownForLiveKickoffIndicators(kickoffBreakdown),
      kickoffBonus
    );
  }

  if (key === 'gv' || key === 'gt') {
    if (!scoreUnchanged && rawCredit > 0 && currentCredit <= rawCredit) {
      return rawCredit;
    }
    return 0;
  }

  if (key === 'pa') {
    if (scoreUnchanged && goalStatCreditsCredited(currentBreakdown) && currentCredit > 0) {
      return 0;
    }
    return rawCredit;
  }

  return rawCredit;
}

/** Una entrada por partido en vivo (mismo orden): true = flecha verde para esa stat. */
export async function getLiveMatchStatIndicatorsByUser(userIds, liveMatchIds = []) {
  const orderedMatchIds = [...new Set(liveMatchIds.map((id) => id.toString()))];
  if (!userIds.length || !orderedMatchIds.length) {
    return { liveMatchIds: orderedMatchIds, byUser: {} };
  }

  const userObjectIds = userIds.map((id) =>
    typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id
  );
  const liveMatchObjectIds = orderedMatchIds.map((id) => new mongoose.Types.ObjectId(id));

  const [predictions, matches] = await Promise.all([
    Prediction.find({
      userId: { $in: userObjectIds },
      matchId: { $in: liveMatchObjectIds },
      pointsEarned: { $ne: null },
    })
      .select(
        'userId matchId homeGoals awayGoals pointsBreakdown bonusPoint liveKickoffBreakdown'
      )
      .lean(),
    Match.find({ _id: { $in: liveMatchObjectIds } })
      .select('homeScore awayScore')
      .lean(),
  ]);

  const matchById = Object.fromEntries(matches.map((match) => [match._id.toString(), match]));

  const predictionByUserMatch = new Map(
    predictions.map((prediction) => [
      `${prediction.userId.toString()}:${prediction.matchId.toString()}`,
      prediction,
    ])
  );

  const byUser = {};
  for (const userId of userIds) {
    const userKey = userId.toString();
    const rowIndicators = Object.fromEntries(
      LIVE_INDICATOR_STAT_KEYS.map((key) => [key, []])
    );

    for (const matchId of orderedMatchIds) {
      const prediction = predictionByUserMatch.get(`${userKey}:${matchId}`);
      if (!prediction) {
        for (const key of LIVE_INDICATOR_STAT_KEYS) {
          rowIndicators[key].push(false);
        }
        continue;
      }

      const currentBreakdown = prediction.pointsBreakdown ?? {};
      const kickoffBonus = 0;
      const match = matchById[matchId] ?? null;

      for (const key of LIVE_INDICATOR_STAT_KEYS) {
        const gained =
          statCreditFromBreakdown(key, currentBreakdown, prediction.bonusPoint ?? 0) >
          resolveKickoffStatCreditForIndicator(key, prediction, kickoffBonus, match);
        rowIndicators[key].push(gained);
      }
    }

    byUser[userKey] = rowIndicators;
  }

  return { liveMatchIds: orderedMatchIds, byUser };
}

function pointsEarnedForLiveKickoffIndicators(breakdown) {
  return breakdown?.winner ?? 0;
}

async function getPredictionStatsByUserAggregated(userIds, { excludeMatchIds = [] } = {}) {
  if (!userIds.length) return {};

  const matchStage = {
    userId: { $in: userIds },
    pointsEarned: { $ne: null },
  };
  if (excludeMatchIds.length > 0) {
    matchStage.matchId = {
      $nin: excludeMatchIds.map((id) => new mongoose.Types.ObjectId(id)),
    };
  }

  const rows = await Prediction.aggregate([
    { $match: matchStage },
    PREDICTION_MATCH_LOOKUP,
    { $unwind: { path: '$matchDoc', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: '$userId',
        pj: { $sum: 1 },
        pa: { $sum: { $cond: [{ $gt: ['$pointsBreakdown.winner', 0] }, 1, 0] } },
        gl: { $sum: { $cond: [{ $gt: ['$pointsBreakdown.homeGoals', 0] }, 1, 0] } },
        gv: { $sum: { $cond: [{ $gt: ['$pointsBreakdown.awayGoals', 0] }, 1, 0] } },
        gt: { $sum: { $cond: [{ $gt: ['$pointsBreakdown.totalGoals', 0] }, 1, 0] } },
        pb: { $sum: { $ifNull: ['$bonusPoint', 0] } },
        difGl: { $sum: goalDiffHomeExpr() },
        difGv: { $sum: goalDiffAwayExpr() },
        totalPoints: {
          $sum: {
            $add: [{ $ifNull: ['$pointsEarned', 0] }, { $ifNull: ['$bonusPoint', 0] }],
          },
        },
      },
    },
  ]);

  return Object.fromEntries(
    rows.map((row) => [
      row._id.toString(),
      {
        pj: row.pj ?? 0,
        pa: row.pa ?? 0,
        gl: row.gl ?? 0,
        gv: row.gv ?? 0,
        gt: row.gt ?? 0,
        pb: row.pb ?? 0,
        difGl: row.difGl ?? 0,
        difGv: row.difGv ?? 0,
        totalPoints: row.totalPoints ?? 0,
      },
    ])
  );
}

/** Stats del ranking como si los partidos indicados siguieran en 0-0 (en vivo o recién finalizados). */
async function getPredictionStatsByUserAtLiveKickoff(userIds, liveKickoffBaselineMatchIds) {
  if (!userIds.length || !liveKickoffBaselineMatchIds.length) return {};

  const liveMatchObjectIds = liveKickoffBaselineMatchIds.map(
    (id) => new mongoose.Types.ObjectId(id)
  );
  const statsMap = Object.fromEntries(userIds.map((id) => [id.toString(), emptyStats()]));

  const [nonLiveRows, livePredictions] = await Promise.all([
    Prediction.aggregate([
      {
        $match: {
          userId: { $in: userIds },
          pointsEarned: { $ne: null },
          matchId: { $nin: liveMatchObjectIds },
        },
      },
      PREDICTION_MATCH_LOOKUP,
      { $unwind: { path: '$matchDoc', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$userId',
          pj: { $sum: 1 },
          pa: { $sum: { $cond: [{ $gt: ['$pointsBreakdown.winner', 0] }, 1, 0] } },
          gl: { $sum: { $cond: [{ $gt: ['$pointsBreakdown.homeGoals', 0] }, 1, 0] } },
          gv: { $sum: { $cond: [{ $gt: ['$pointsBreakdown.awayGoals', 0] }, 1, 0] } },
          gt: { $sum: { $cond: [{ $gt: ['$pointsBreakdown.totalGoals', 0] }, 1, 0] } },
          pb: { $sum: { $ifNull: ['$bonusPoint', 0] } },
          difGl: { $sum: goalDiffHomeExpr() },
          difGv: { $sum: goalDiffAwayExpr() },
          totalPoints: {
            $sum: {
              $add: [{ $ifNull: ['$pointsEarned', 0] }, { $ifNull: ['$bonusPoint', 0] }],
            },
          },
        },
      },
    ]),
    Prediction.find({
      userId: { $in: userIds },
      matchId: { $in: liveMatchObjectIds },
      pointsEarned: { $ne: null },
    })
      .select(
        'userId matchId homeGoals awayGoals pointsEarned pointsBreakdown bonusPoint goalDiffHome goalDiffAway liveKickoffBreakdown liveKickoffPointsEarned liveKickoffGoalDiffHome liveKickoffGoalDiffAway'
      )
      .lean(),
  ]);

  for (const row of nonLiveRows) {
    statsMap[row._id.toString()] = {
      pj: row.pj ?? 0,
      pa: row.pa ?? 0,
      gl: row.gl ?? 0,
      gv: row.gv ?? 0,
      gt: row.gt ?? 0,
      pb: row.pb ?? 0,
      difGl: row.difGl ?? 0,
      difGv: row.difGv ?? 0,
      totalPoints: row.totalPoints ?? 0,
    };
  }

  for (const prediction of livePredictions) {
    const userKey = prediction.userId.toString();
    const stats = statsMap[userKey];
    if (!stats) continue;

    let fullBreakdown;
    let goalDiff;

    if (prediction.liveKickoffBreakdown) {
      fullBreakdown = prediction.liveKickoffBreakdown;
      goalDiff = {
        home: prediction.liveKickoffGoalDiffHome ?? prediction.homeGoals ?? 0,
        away: prediction.liveKickoffGoalDiffAway ?? prediction.awayGoals ?? 0,
      };
    } else {
      const kickoff = calculatePoints(
        { home: prediction.homeGoals, away: prediction.awayGoals },
        { home: 0, away: 0 }
      );
      fullBreakdown = kickoff.breakdown;
      goalDiff = calculateGoalDiff(
        { home: prediction.homeGoals, away: prediction.awayGoals },
        { home: 0, away: 0 }
      );
    }

    const breakdown = breakdownForLiveKickoffIndicators(fullBreakdown);
    const pointsEarned = pointsEarnedForLiveKickoffIndicators(fullBreakdown);

    accumulateLeaderboardStats(stats, breakdown, pointsEarned, prediction.bonusPoint ?? 0, goalDiff);
  }

  return statsMap;
}

async function getPredictionStatsByUser(userIds, options = {}) {
  const { liveKickoffBaselineMatchIds = [], excludeMatchIds = [] } = options;
  if (liveKickoffBaselineMatchIds.length > 0) {
    return getPredictionStatsByUserAtLiveKickoff(userIds, liveKickoffBaselineMatchIds);
  }
  return getPredictionStatsByUserAggregated(userIds, { excludeMatchIds });
}

export function compareRankingEntries(a, b) {
  const pointsA = a.points ?? a.totalPoints ?? 0;
  const pointsB = b.points ?? b.totalPoints ?? 0;
  if (pointsB !== pointsA) return pointsB - pointsA;
  if (b.pa !== a.pa) return b.pa - a.pa;

  const glgvA = (a.gl ?? 0) + (a.gv ?? 0);
  const glgvB = (b.gl ?? 0) + (b.gv ?? 0);
  if (glgvB !== glgvA) return glgvB - glgvA;

  if (b.gt !== a.gt) return b.gt - a.gt;
  // PB al final: menos PB = mejor posición (consuelo no adelanta)
  if (a.pb !== b.pb) return a.pb - b.pb;
  const gdifCmp = compareGoalDiffScore(a.difGl, a.difGv, a.pj, b.difGl, b.difGv, b.pj);
  if (gdifCmp !== 0) return gdifCmp;
  const difLocalCmp = compareAvgGoalDiff(a.difGl, a.pj, b.difGl, b.pj);
  if (difLocalCmp !== 0) return difLocalCmp;
  const difVisitCmp = compareAvgGoalDiff(a.difGv, a.pj, b.difGv, b.pj);
  if (difVisitCmp !== 0) return difVisitCmp;
  return a.name.localeCompare(b.name, 'es');
}

export const compareLeaderboardEntries = compareRankingEntries;

export async function getLeaderboard(competitionGroupId, limit = 100, options = {}) {
  const { liveKickoffBaselineMatchIds = [], excludeMatchIds = [] } = options;
  let filter = {};
  if (competitionGroupId === '__nogroup') {
    const memberUserIds = await UserGroupMembership.distinct('userId');
    filter = { _id: { $nin: memberUserIds } };
  } else if (competitionGroupId) {
    const memberUserIds = await UserGroupMembership.find({
      groupId: new mongoose.Types.ObjectId(competitionGroupId),
    }).distinct('userId');
    filter = { _id: { $in: memberUserIds } };
  }

  const users = await User.find(filter).select(
    'name totalPoints createdAt activeCompetitionGroupId competitionGroupId isAiUser avatarDataUrl'
  );
  const statsMap = await getPredictionStatsByUser(users.map((u) => u._id), {
    liveKickoffBaselineMatchIds,
    excludeMatchIds,
  });
  const groupIds = [
    ...new Set(
      users
        .map((user) => user.activeCompetitionGroupId || user.competitionGroupId)
        .filter(Boolean)
        .map((id) => id.toString())
    ),
  ];
  const groups = await CompetitionGroup.find({ _id: { $in: groupIds } }).select('name').lean();
  const groupNameById = Object.fromEntries(groups.map((group) => [group._id.toString(), group.name]));

  const rows = users.map((user) => {
    const stats = statsMap[user._id.toString()] ?? emptyStats();
    return {
      id: user._id.toString(),
      name: user.name,
      avatarUrl: resolvePublicAvatarUrl({
        isAiUser: user.isAiUser,
        avatarDataUrl: user.avatarDataUrl,
        userId: user._id.toString(),
      }),
      isAiUser: Boolean(user.isAiUser),
      groupName: groupNameById[(user.activeCompetitionGroupId || user.competitionGroupId)?.toString()] || null,
      totalPoints: stats.totalPoints ?? 0,
      pj: stats.pj ?? 0,
      pa: stats.pa ?? 0,
      gl: stats.gl ?? 0,
      gv: stats.gv ?? 0,
      gt: stats.gt ?? 0,
      pb: stats.pb ?? 0,
      difGl: stats.difGl ?? 0,
      difGv: stats.difGv ?? 0,
    };
  });

  rows.sort(compareLeaderboardEntries);

  return rows.slice(0, limit).map((row, index) => ({
    ...row,
    rank: index + 1,
  }));
}

export async function recalculateUserTotalPoints(userId) {
  const uid =
    typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
  const agg = await Prediction.aggregate([
    { $match: { userId: uid, pointsEarned: { $ne: null } } },
    {
      $group: {
        _id: null,
        total: {
          $sum: {
            $add: ['$pointsEarned', { $ifNull: ['$bonusPoint', 0] }],
          },
        },
      },
    },
  ]);

  const total = agg[0]?.total ?? 0;
  await User.findByIdAndUpdate(userId, { totalPoints: total });
  return total;
}

export async function recalculateAllUserTotals() {
  const userIds = await Prediction.distinct('userId');
  for (const userId of userIds) {
    await recalculateUserTotalPoints(userId);
  }
}
