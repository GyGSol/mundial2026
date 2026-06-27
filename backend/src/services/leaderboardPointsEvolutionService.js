import mongoose from 'mongoose';
import { Match } from '../models/Match.js';
import { Prediction } from '../models/Prediction.js';
import { Team } from '../models/Team.js';
import { User } from '../models/User.js';
import { UserGroupMembership } from '../models/UserGroupMembership.js';
import { getCompetitionGroupById } from './competitionGroupService.js';
import { resolvePublicAvatarUrl } from './userAvatarService.js';
import { buildPointsEvolutionFromRaw } from '../../../shared/leaderboardEvolution.js';

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

  return User.aggregate([
    { $match: filter },
    {
      $project: {
        name: 1,
        isAiUser: 1,
        hasAvatar: {
          $gt: [{ $strLenCP: { $ifNull: ['$avatarDataUrl', ''] } }, 0],
        },
      },
    },
  ]);
}

function compareMatchesChronologically(a, b) {
  const aKick = a.kickoffAt ? new Date(a.kickoffAt).getTime() : 0;
  const bKick = b.kickoffAt ? new Date(b.kickoffAt).getTime() : 0;
  if (aKick !== bKick) return aKick - bKick;
  return String(a.externalId).localeCompare(String(b.externalId));
}

export async function getLeaderboardPointsEvolutionRaw(competitionGroupId) {
  const groupResult = await resolveGroup(competitionGroupId);
  if (groupResult.notFound) {
    return { notFound: true };
  }

  const users = await getGroupMemberUsers(competitionGroupId);
  if (!users.length) {
    return {
      group: groupResult.group,
      users: [],
      matches: [],
      predictions: [],
      teams: [],
      hasLiveMatches: false,
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
      ? await Match.find({ _id: { $in: matchIds } })
          .select('externalId kickoffAt homeTeamId awayTeamId homeScore awayScore')
          .lean()
      : [];
  matches.sort(compareMatchesChronologically);

  const teamIds = [...new Set(matches.flatMap((match) => [match.homeTeamId, match.awayTeamId]))];
  const teams = teamIds.length
    ? await Team.find({ externalId: { $in: teamIds } }).select('externalId fifaCode nameEn').lean()
    : [];

  const liveCount = await Match.countDocuments({ status: 'live' });

  return {
    group: groupResult.group,
    users: users.map((user) => {
      const userId = user._id.toString();
      return {
        id: userId,
        name: user.name,
        isAiUser: Boolean(user.isAiUser),
        avatarUrl: resolvePublicAvatarUrl({
          isAiUser: user.isAiUser,
          hasAvatar: user.hasAvatar,
          userId,
        }),
      };
    }),
    matches: matches.map((match) => ({
      id: match._id.toString(),
      externalId: match.externalId,
      kickoffAt: match.kickoffAt?.toISOString?.() ?? match.kickoffAt ?? null,
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
    })),
    predictions: predictions.map((prediction) => ({
      userId: prediction.userId.toString(),
      matchId: prediction.matchId.toString(),
      pointsEarned: prediction.pointsEarned,
      bonusPoint: prediction.bonusPoint ?? 0,
      pointsBreakdown: prediction.pointsBreakdown,
      goalDiffHome: prediction.goalDiffHome,
      goalDiffAway: prediction.goalDiffAway,
      homeGoals: prediction.homeGoals,
      awayGoals: prediction.awayGoals,
    })),
    teams: teams.map((team) => ({
      externalId: team.externalId,
      fifaCode: team.fifaCode,
      nameEn: team.nameEn,
    })),
    hasLiveMatches: liveCount > 0,
  };
}

export async function getLeaderboardPointsEvolution(competitionGroupId) {
  const raw = await getLeaderboardPointsEvolutionRaw(competitionGroupId);
  if (raw.notFound) {
    return { notFound: true };
  }
  return buildPointsEvolutionFromRaw(raw);
}
