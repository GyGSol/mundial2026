import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { UserGroupMembership } from '../models/UserGroupMembership.js';
import { CompetitionGroup } from '../models/CompetitionGroup.js';
import { Match } from '../models/Match.js';
import { Team } from '../models/Team.js';
import { Prediction } from '../models/Prediction.js';
import { SyncMeta } from '../models/SyncMeta.js';
import {
  listCompetitionGroupMembers,
  deleteCompetitionGroup,
} from './competitionGroupService.js';
import { recalculateMatchScores } from './syncService.js';
import { env } from '../config/env.js';
import { isAdminConfigured } from './adminSetupService.js';

function serializeUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    totalPoints: user.totalPoints ?? 0,
    activeCompetitionGroupId: user.activeCompetitionGroupId?.toString() ?? null,
    competitionGroupId: user.competitionGroupId?.toString() ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function serializeGroup(group) {
  return {
    id: group._id.toString(),
    name: group.name,
    description: group.description ?? '',
    createdBy: group.createdBy?.toString() ?? null,
    prizesWinnersCount: group.prizesWinnersCount ?? 0,
    memberCount: group.memberCount,
    createdAt: group.createdAt,
  };
}

function serializeMatch(match) {
  return {
    id: match._id.toString(),
    externalId: match.externalId,
    homeTeamId: match.homeTeamId,
    awayTeamId: match.awayTeamId,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    group: match.group,
    matchday: match.matchday,
    status: match.status,
    kickoffAt: match.kickoffAt,
    type: match.type,
    lastSyncedAt: match.lastSyncedAt,
  };
}

export async function getAdminStats() {
  const [
    usersCount,
    groupsCount,
    membershipsCount,
    predictionsCount,
    teamsCount,
    matchesByStatus,
    meta,
  ] = await Promise.all([
    User.countDocuments(),
    CompetitionGroup.countDocuments(),
    UserGroupMembership.countDocuments(),
    Prediction.countDocuments(),
    Team.countDocuments(),
    Match.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    SyncMeta.findOne({ key: 'global' }).lean(),
  ]);

  const matchStatusCounts = { upcoming: 0, live: 0, finished: 0 };
  for (const row of matchesByStatus) {
    if (row._id && row._id in matchStatusCounts) {
      matchStatusCounts[row._id] = row.count;
    }
  }
  const matchesCount =
    matchStatusCounts.upcoming + matchStatusCounts.live + matchStatusCounts.finished;

  return {
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    usersCount,
    groupsCount,
    membershipsCount,
    predictionsCount,
    teamsCount,
    matchesCount,
    matchStatusCounts,
    lastSyncAt: meta?.lastSyncAt ?? null,
    lastSyncError: meta?.lastSyncError ?? null,
    syncCredentialsConfigured: Boolean(env.worldCupSyncEmail && env.worldCupSyncPassword),
    adminConfigured: await isAdminConfigured(),
  };
}

export async function listAdminUsers({ page = 1, limit = 20, q = '' }) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);
  const filter = {};
  const trimmed = String(q).trim();
  if (trimmed) {
    filter.$or = [
      { email: { $regex: trimmed, $options: 'i' } },
      { name: { $regex: trimmed, $options: 'i' } },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .select('-passwordHash')
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    User.countDocuments(filter),
  ]);

  return {
    users: users.map(serializeUser),
    page: safePage,
    limit: safeLimit,
    total,
    totalPages: Math.ceil(total / safeLimit) || 1,
  };
}

export async function getAdminUserById(userId) {
  const user = await User.findById(userId).select('-passwordHash').lean();
  if (!user) {
    const error = new Error('Usuario no encontrado');
    error.status = 404;
    throw error;
  }

  const [memberships, recentPredictions] = await Promise.all([
    UserGroupMembership.find({ userId: user._id })
      .populate('groupId', 'name')
      .sort({ createdAt: -1 })
      .lean(),
    Prediction.find({ userId: user._id })
      .sort({ updatedAt: -1 })
      .limit(10)
      .populate('matchId', 'homeTeamId awayTeamId status')
      .lean(),
  ]);

  return {
    user: serializeUser(user),
    memberships: memberships.map((m) => ({
      groupId: m.groupId?._id?.toString() ?? m.groupId?.toString(),
      groupName: m.groupId?.name ?? null,
      role: m.role,
      joinedAt: m.createdAt,
    })),
    recentPredictions: recentPredictions.map((p) => ({
      id: p._id.toString(),
      matchId: p.matchId?._id?.toString(),
      homeGoals: p.homeGoals,
      awayGoals: p.awayGoals,
      pointsEarned: p.pointsEarned,
      match: p.matchId
        ? {
            homeTeamId: p.matchId.homeTeamId,
            awayTeamId: p.matchId.awayTeamId,
            status: p.matchId.status,
          }
        : null,
    })),
  };
}

export async function updateAdminUserPoints(userId, totalPoints) {
  const points = Number(totalPoints);
  if (!Number.isFinite(points) || points < 0) {
    const error = new Error('totalPoints debe ser un número >= 0');
    error.status = 400;
    throw error;
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: { totalPoints: Math.floor(points) } },
    { new: true }
  )
    .select('-passwordHash')
    .lean();

  if (!user) {
    const error = new Error('Usuario no encontrado');
    error.status = 404;
    throw error;
  }

  return serializeUser(user);
}

export async function deleteAdminUser(userId) {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('Usuario no encontrado');
    error.status = 404;
    throw error;
  }

  await Promise.all([
    Prediction.deleteMany({ userId: user._id }),
    UserGroupMembership.deleteMany({ userId: user._id }),
  ]);
  await User.deleteOne({ _id: user._id });

  return { deleted: true, userId: user._id.toString() };
}

export async function listAdminGroups() {
  const groups = await CompetitionGroup.find().sort({ createdAt: -1 }).lean();
  const counts = await UserGroupMembership.aggregate([
    { $group: { _id: '$groupId', count: { $sum: 1 } } },
  ]);
  const countMap = Object.fromEntries(counts.map((c) => [c._id.toString(), c.count]));

  return groups.map((g) =>
    serializeGroup({
      ...g,
      memberCount: countMap[g._id.toString()] ?? 0,
    })
  );
}

export async function getAdminGroupMembers(groupId) {
  return listCompetitionGroupMembers(groupId);
}

export async function deleteAdminGroup(groupId) {
  return deleteCompetitionGroup({
    groupId,
    userId: null,
    adminOverride: true,
  });
}

export async function listAdminMatches({ status, group } = {}) {
  const filter = {};
  if (status) filter.status = status;
  if (group) filter.group = group;

  const matches = await Match.find(filter).sort({ kickoffAt: 1 }).limit(500).lean();
  return matches.map(serializeMatch);
}

export async function updateAdminMatch(matchId, { homeScore, awayScore, status }) {
  const match = await Match.findById(matchId);
  if (!match) {
    const error = new Error('Partido no encontrado');
    error.status = 404;
    throw error;
  }

  if (homeScore !== undefined) match.homeScore = Number(homeScore);
  if (awayScore !== undefined) match.awayScore = Number(awayScore);
  if (status !== undefined) {
    if (!['upcoming', 'live', 'finished'].includes(status)) {
      const error = new Error('status inválido');
      error.status = 400;
      throw error;
    }
    match.status = status;
  }

  await match.save();

  if (match.status === 'finished') {
    await recalculateMatchScores(match._id);
  }

  return serializeMatch(match);
}

export async function recalculateAdminMatch(matchId) {
  const match = await Match.findById(matchId);
  if (!match) {
    const error = new Error('Partido no encontrado');
    error.status = 404;
    throw error;
  }
  await recalculateMatchScores(match._id);
  return { recalculated: true, matchId: match._id.toString() };
}

export async function recalculateAllFinishedMatches() {
  const finished = await Match.find({ status: 'finished' }).select('_id').lean();
  for (const m of finished) {
    await recalculateMatchScores(m._id);
  }
  return { recalculated: finished.length };
}

function teamLabel(team, fallbackId) {
  if (!team) return fallbackId || '—';
  return team.fifaCode || team.nameEn || team.externalId || fallbackId || '—';
}

export async function listAdminPredictions({ userId } = {}) {
  const filter = {};
  if (userId) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      const error = new Error('userId inválido');
      error.status = 400;
      throw error;
    }
    filter.userId = userId;
  }

  const predictions = await Prediction.find(filter)
    .populate('userId', 'name email')
    .populate(
      'matchId',
      'homeTeamId awayTeamId status homeScore awayScore group kickoffAt externalId'
    )
    .lean();

  const teamIds = new Set();
  for (const p of predictions) {
    if (p.matchId?.homeTeamId) teamIds.add(p.matchId.homeTeamId);
    if (p.matchId?.awayTeamId) teamIds.add(p.matchId.awayTeamId);
  }

  const teams = teamIds.size
    ? await Team.find({ externalId: { $in: [...teamIds] } }).lean()
    : [];
  const teamMap = Object.fromEntries(teams.map((t) => [t.externalId, t]));

  const rows = predictions.map((p) => {
    const match = p.matchId;
    const homeTeam = match ? teamMap[match.homeTeamId] : null;
    const awayTeam = match ? teamMap[match.awayTeamId] : null;
    const homeLabel = teamLabel(homeTeam, match?.homeTeamId);
    const awayLabel = teamLabel(awayTeam, match?.awayTeamId);

    return {
      id: p._id.toString(),
      userId: p.userId?._id?.toString(),
      userName: p.userId?.name,
      userEmail: p.userId?.email,
      matchId: match?._id?.toString(),
      homeGoals: p.homeGoals,
      awayGoals: p.awayGoals,
      pointsEarned: p.pointsEarned,
      updatedAt: p.updatedAt,
      match: match
        ? {
            externalId: match.externalId,
            homeTeamId: match.homeTeamId,
            awayTeamId: match.awayTeamId,
            status: match.status,
            homeScore: match.homeScore,
            awayScore: match.awayScore,
            group: match.group,
            kickoffAt: match.kickoffAt,
            label: `${homeLabel} vs ${awayLabel}`,
          }
        : null,
    };
  });

  rows.sort((a, b) => {
    const kickA = a.match?.kickoffAt ? new Date(a.match.kickoffAt).getTime() : 0;
    const kickB = b.match?.kickoffAt ? new Date(b.match.kickoffAt).getTime() : 0;
    if (kickA !== kickB) return kickA - kickB;
    const userA = (a.userName || a.userEmail || '').toLowerCase();
    const userB = (b.userName || b.userEmail || '').toLowerCase();
    return userA.localeCompare(userB, 'es');
  });

  return rows;
}

export async function getAdminSyncStatus() {
  const meta = await SyncMeta.findOne({ key: 'global' }).lean();
  return {
    lastSyncAt: meta?.lastSyncAt ?? null,
    lastSyncError: meta?.lastSyncError ?? null,
    syncCredentialsConfigured: Boolean(env.worldCupSyncEmail && env.worldCupSyncPassword),
    worldCupApiUrl: env.worldCupApiUrl,
    syncIntervalMs: env.syncIntervalMs,
  };
}
