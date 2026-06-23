import mongoose from 'mongoose';
import { Match } from '../models/Match.js';
import { Prediction } from '../models/Prediction.js';
import { Team } from '../models/Team.js';
import { User } from '../models/User.js';
import { UserGroupMembership } from '../models/UserGroupMembership.js';
import { getCompetitionGroupById } from './competitionGroupService.js';
import { resolvePublicAvatarUrl } from './userAvatarService.js';
import {
  accumulateLeaderboardStats,
  compareLeaderboardEntries,
  createEmptyLeaderboardStats,
} from './leaderboardService.js';
import { calculateGoalDiff } from './scoringService.js';
import { assignPlayerChartColors } from '../../../shared/playerChartColors.js';

async function resolveGroup(groupId) {
  if (!groupId) {
    return { group: null };
  }
  if (groupId === '__nogroup') {
    return { group: { id: '__nogroup', name: 'Sin grupo' } };
  }
  const group = await getCompetitionGroupById(groupId);
  if (!group) {
    return { group: null, notFound: true };
  }
  return { group };
}

async function getGroupMemberUsers(competitionGroupId) {
  let filter = {};
  if (competitionGroupId === '__nogroup') {
    const memberUserIds = await UserGroupMembership.distinct('userId');
    filter = { _id: { $nin: memberUserIds } };
  } else if (competitionGroupId) {
    const memberUserIds = await UserGroupMembership.find({
      groupId: new mongoose.Types.ObjectId(competitionGroupId),
    }).distinct('userId');
    filter = { _id: { $in: memberUserIds } };
  } else {
    return [];
  }

  return User.find(filter)
    .select('name isAiUser avatarDataUrl')
    .lean();
}

function teamCode(team) {
  if (!team) return null;
  return team.fifaCode?.trim() || team.nameEn?.slice(0, 3).toUpperCase() || null;
}

function formatCheckpointLabel(match, teamByExternalId) {
  const homeTeam = teamByExternalId.get(match.homeTeamId);
  const awayTeam = teamByExternalId.get(match.awayTeamId);
  const home = teamCode(homeTeam) ?? match.homeTeamId;
  const away = teamCode(awayTeam) ?? match.awayTeamId;
  return `${home} · ${away}`;
}

function compareMatchesChronologically(a, b) {
  const aKick = a.kickoffAt ? new Date(a.kickoffAt).getTime() : 0;
  const bKick = b.kickoffAt ? new Date(b.kickoffAt).getTime() : 0;
  if (aKick !== bKick) return aKick - bKick;
  return String(a.externalId).localeCompare(String(b.externalId));
}

function computeRanksByUserId(users, statsByUserId) {
  const rows = users.map((user) => {
    const userId = user._id.toString();
    const stats = statsByUserId.get(userId) ?? createEmptyLeaderboardStats();
    return { userId, name: user.name, ...stats };
  });
  rows.sort(compareLeaderboardEntries);
  return new Map(rows.map((row, index) => [row.userId, index + 1]));
}

function appendRankSnapshot(users, statsByUserId, ranksSeriesByUserId) {
  const ranksByUserId = computeRanksByUserId(users, statsByUserId);
  for (const user of users) {
    const userId = user._id.toString();
    ranksSeriesByUserId.get(userId).push(ranksByUserId.get(userId));
  }
}

function goalDiffForPrediction(prediction, match) {
  if (prediction.goalDiffHome != null || prediction.goalDiffAway != null) {
    return {
      home: prediction.goalDiffHome ?? 0,
      away: prediction.goalDiffAway ?? 0,
    };
  }
  return calculateGoalDiff(
    { home: prediction.homeGoals, away: prediction.awayGoals },
    { home: match.homeScore ?? 0, away: match.awayScore ?? 0 }
  );
}

export async function getLeaderboardPointsEvolution(competitionGroupId) {
  const groupResult = await resolveGroup(competitionGroupId);
  if (groupResult.notFound) {
    return { notFound: true };
  }

  const users = await getGroupMemberUsers(competitionGroupId);
  if (!users.length) {
    return {
      group: groupResult.group,
      checkpoints: [{ index: 0, label: 'Inicio', matchId: null }],
      series: [],
      hasLiveMatches: false,
      lastUpdatedAt: new Date().toISOString(),
    };
  }

  const userIds = users.map((user) => user._id);
  const predictions = await Prediction.find({
    userId: { $in: userIds },
    pointsEarned: { $ne: null },
  })
    .select(
      'userId matchId pointsEarned bonusPoint pointsBreakdown goalDiffHome goalDiffAway homeGoals awayGoals'
    )
    .lean();

  const matchIds = [...new Set(predictions.map((prediction) => prediction.matchId.toString()))];
  const matches =
    matchIds.length > 0
      ? await Match.find({ _id: { $in: matchIds } }).lean()
      : [];
  matches.sort(compareMatchesChronologically);

  const teamIds = [...new Set(matches.flatMap((match) => [match.homeTeamId, match.awayTeamId]))];
  const teams = teamIds.length
    ? await Team.find({ externalId: { $in: teamIds } }).select('externalId fifaCode nameEn').lean()
    : [];
  const teamByExternalId = new Map(teams.map((team) => [team.externalId, team]));

  const predictionByUserMatch = new Map(
    predictions.map((prediction) => [
      `${prediction.userId.toString()}:${prediction.matchId.toString()}`,
      prediction,
    ])
  );

  const checkpoints = [
    { index: 0, label: 'Inicio', matchId: null },
    ...matches.map((match, idx) => ({
      index: idx + 1,
      label: formatCheckpointLabel(match, teamByExternalId),
      matchId: match._id.toString(),
    })),
  ];

  const statsByUserId = new Map(
    users.map((user) => [user._id.toString(), createEmptyLeaderboardStats()])
  );
  const ranksSeriesByUserId = new Map(
    users.map((user) => [user._id.toString(), [0]])
  );

  for (const match of matches) {
    for (const user of users) {
      const userId = user._id.toString();
      const prediction = predictionByUserMatch.get(`${userId}:${match._id.toString()}`);
      if (!prediction) continue;

      const stats = statsByUserId.get(userId);
      accumulateLeaderboardStats(
        stats,
        prediction.pointsBreakdown,
        prediction.pointsEarned,
        prediction.bonusPoint ?? 0,
        goalDiffForPrediction(prediction, match)
      );
    }
    appendRankSnapshot(users, statsByUserId, ranksSeriesByUserId);
  }

  const finalRanks = computeRanksByUserId(users, statsByUserId);
  const sortedUsers = [...users].sort((a, b) => {
    const rankA = finalRanks.get(a._id.toString()) ?? users.length;
    const rankB = finalRanks.get(b._id.toString()) ?? users.length;
    if (rankA !== rankB) return rankA - rankB;
    return a.name.localeCompare(b.name, 'es');
  });

  const colorByUserId = assignPlayerChartColors(users.map((user) => user._id.toString()));

  const series = sortedUsers.map((user) => {
    const userId = user._id.toString();
    return {
      userId,
      name: user.name,
      avatarUrl: resolvePublicAvatarUrl({
        isAiUser: user.isAiUser,
        avatarDataUrl: user.avatarDataUrl,
        userId,
      }),
      isAiUser: Boolean(user.isAiUser),
      color: colorByUserId.get(userId),
      ranks: ranksSeriesByUserId.get(userId) ?? [],
    };
  });

  const liveCount = await Match.countDocuments({ status: 'live' });

  return {
    group: groupResult.group,
    checkpoints,
    series,
    hasLiveMatches: liveCount > 0,
    lastUpdatedAt: new Date().toISOString(),
  };
}
