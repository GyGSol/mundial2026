import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { UserGroupMembership } from '../models/UserGroupMembership.js';
import { CompetitionGroup } from '../models/CompetitionGroup.js';
import { Match } from '../models/Match.js';
import { Team } from '../models/Team.js';
import { Prediction } from '../models/Prediction.js';
import { SyncMeta } from '../models/SyncMeta.js';
import {
  addGroupMemberDirect,
  approveJoinRequest,
  createCompetitionGroup,
  deleteCompetitionGroup,
  getCompetitionGroupById,
  listCompetitionGroupMembers,
  listGroupJoinRequests,
  rejectJoinRequest,
  removeGroupMember,
  updateCompetitionGroup,
} from './competitionGroupService.js';
import { recalculateMatchScores, clearMatchScores } from './syncService.js';
import { recalculateUserTotalPoints } from './leaderboardService.js';
import { revokeAllUserSessions } from './sessionService.js';
import { notifyLeaderboardUpdated, notifyMatchesUpdated } from './websocketService.js';
import { env } from '../config/env.js';
import { isAdminConfigured } from './adminSetupService.js';

const MIN_USER_PASSWORD_LENGTH = 8;

function serializeUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    totalPoints: user.totalPoints ?? 0,
    isAiUser: Boolean(user.isAiUser),
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

export async function updateAdminUserPassword(userId, password) {
  const plainPassword = String(password ?? '');
  if (plainPassword.length < MIN_USER_PASSWORD_LENGTH) {
    const error = new Error(`La contraseña debe tener al menos ${MIN_USER_PASSWORD_LENGTH} caracteres`);
    error.status = 400;
    throw error;
  }

  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('Usuario no encontrado');
    error.status = 404;
    throw error;
  }

  user.passwordHash = await bcrypt.hash(plainPassword, 10);
  await user.save();
  await revokeAllUserSessions(user._id);

  return serializeUser(user.toObject());
}

export async function updateAdminUserProfile(userId, { name, email }) {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('Usuario no encontrado');
    error.status = 404;
    throw error;
  }

  if (name !== undefined) {
    const trimmedName = String(name).trim();
    if (!trimmedName) {
      const error = new Error('El nombre es obligatorio');
      error.status = 400;
      throw error;
    }
    if (trimmedName.length > 80) {
      const error = new Error('El nombre no puede superar 80 caracteres');
      error.status = 400;
      throw error;
    }
    user.name = trimmedName;
  }

  if (email !== undefined) {
    const normalizedEmail = String(email).trim().toLowerCase();
    if (!normalizedEmail) {
      const error = new Error('El email es obligatorio');
      error.status = 400;
      throw error;
    }
    const duplicate = await User.findOne({
      email: normalizedEmail,
      _id: { $ne: user._id },
    });
    if (duplicate) {
      const error = new Error('Ya existe un usuario con ese email');
      error.status = 409;
      throw error;
    }
    user.email = normalizedEmail;
  }

  await user.save();
  return serializeUser(user.toObject());
}

export async function createAdminUser({ name, email, password, totalPoints = 0 }) {
  const trimmedName = String(name ?? '').trim();
  const normalizedEmail = String(email ?? '').trim().toLowerCase();
  const plainPassword = String(password ?? '');

  if (!trimmedName || !normalizedEmail || !plainPassword) {
    const error = new Error('Nombre, email y contraseña son obligatorios');
    error.status = 400;
    throw error;
  }
  if (plainPassword.length < MIN_USER_PASSWORD_LENGTH) {
    const error = new Error(`La contraseña debe tener al menos ${MIN_USER_PASSWORD_LENGTH} caracteres`);
    error.status = 400;
    throw error;
  }

  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    const error = new Error('Ya existe un usuario con ese email');
    error.status = 409;
    throw error;
  }

  const points = Number(totalPoints);
  const user = await User.create({
    name: trimmedName,
    email: normalizedEmail,
    passwordHash: await bcrypt.hash(plainPassword, 10),
    totalPoints: Number.isFinite(points) && points >= 0 ? Math.floor(points) : 0,
  });

  return serializeUser(user.toObject());
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

export async function getAdminGroup(groupId) {
  const group = await getCompetitionGroupById(groupId);
  if (!group) {
    const error = new Error('Grupo no encontrado');
    error.status = 404;
    throw error;
  }
  const memberCount = await UserGroupMembership.countDocuments({
    groupId: new mongoose.Types.ObjectId(groupId),
  });
  return { ...group, memberCount };
}

export async function createAdminGroup({ name, description, prizesWinnersCount = 0, prizes = [] }) {
  return createCompetitionGroup({
    name,
    description,
    prizesWinnersCount,
    prizes,
    internal: true,
  });
}

export async function updateAdminGroup({
  groupId,
  name,
  description,
  prizesWinnersCount = 0,
  prizes = [],
}) {
  return updateCompetitionGroup({
    groupId,
    name,
    description,
    userId: null,
    prizesWinnersCount,
    prizes,
    adminOverride: true,
  });
}

export async function getAdminGroupMembers(groupId) {
  return listCompetitionGroupMembers(groupId, { includeRoles: true });
}

export async function deleteAdminGroup(groupId) {
  return deleteCompetitionGroup({
    groupId,
    userId: null,
    adminOverride: true,
  });
}

export async function addAdminGroupMember({ groupId, email, userId }) {
  let targetUserId = userId;
  if (!targetUserId && email) {
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      const error = new Error('Usuario no encontrado con ese email');
      error.status = 404;
      throw error;
    }
    targetUserId = user._id;
  }
  if (!targetUserId) {
    const error = new Error('Indicá userId o email');
    error.status = 400;
    throw error;
  }
  return addGroupMemberDirect({
    groupId,
    targetUserId,
    adminOverride: true,
  });
}

export async function removeAdminGroupMember({ groupId, userId }) {
  return removeGroupMember({
    groupId,
    targetUserId: userId,
    userId: null,
    adminOverride: true,
  });
}

export async function updateAdminGroupMemberRole({ groupId, userId, role }) {
  if (!['member', 'owner'].includes(role)) {
    const error = new Error('role debe ser member u owner');
    error.status = 400;
    throw error;
  }

  const membership = await UserGroupMembership.findOne({
    groupId: new mongoose.Types.ObjectId(groupId),
    userId: new mongoose.Types.ObjectId(userId),
  });
  if (!membership) {
    const error = new Error('Membresía no encontrada');
    error.status = 404;
    throw error;
  }

  membership.role = role;
  await membership.save();

  if (role === 'owner') {
    await CompetitionGroup.findByIdAndUpdate(groupId, { createdBy: userId });
  }

  return {
    userId: membership.userId.toString(),
    groupId: membership.groupId.toString(),
    role: membership.role,
  };
}

export async function listAdminGroupJoinRequests(groupId) {
  return listGroupJoinRequests({
    groupId,
    userId: null,
    adminOverride: true,
  });
}

export async function approveAdminJoinRequest({ groupId, userId }) {
  return approveJoinRequest({
    groupId,
    targetUserId: userId,
    userId: null,
    adminOverride: true,
  });
}

export async function rejectAdminJoinRequest({ groupId, userId }) {
  return rejectJoinRequest({
    groupId,
    targetUserId: userId,
    userId: null,
    adminOverride: true,
  });
}

export async function listAdminMatches({ status, group } = {}) {
  const filter = {};
  if (status) filter.status = status;
  if (group) filter.group = group;

  const matches = await Match.find(filter).sort({ kickoffAt: 1 }).limit(500).lean();

  const teamIds = new Set();
  for (const m of matches) {
    if (m.homeTeamId) teamIds.add(m.homeTeamId);
    if (m.awayTeamId) teamIds.add(m.awayTeamId);
  }

  const teams = teamIds.size
    ? await Team.find({ externalId: { $in: [...teamIds] } }).lean()
    : [];
  const teamMap = Object.fromEntries(teams.map((t) => [t.externalId, t]));

  return matches.map((match) => {
    const homeLabel = teamLabel(teamMap[match.homeTeamId], match.homeTeamId);
    const awayLabel = teamLabel(teamMap[match.awayTeamId], match.awayTeamId);
    return {
      ...serializeMatch(match),
      label: `${homeLabel} vs ${awayLabel}`,
    };
  });
}

export async function updateAdminMatch(matchId, { homeScore, awayScore, status, group, matchday, kickoffAt }) {
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
  if (group !== undefined) match.group = group ? String(group).trim() : null;
  if (matchday !== undefined) match.matchday = matchday ? String(matchday).trim() : null;
  if (kickoffAt !== undefined) {
    if (kickoffAt === null || kickoffAt === '') {
      match.kickoffAt = null;
    } else {
      const parsed = new Date(kickoffAt);
      if (Number.isNaN(parsed.getTime())) {
        const error = new Error('kickoffAt inválido');
        error.status = 400;
        throw error;
      }
      match.kickoffAt = parsed;
    }
  }

  await match.save();

  if (match.status === 'finished' || match.status === 'live') {
    await recalculateMatchScores(match._id);
  } else if (match.status === 'upcoming') {
    await clearMatchScores(match._id);
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

async function resolvePredictionMatchIds({ matchId, status, group } = {}) {
  if (matchId) {
    if (!mongoose.Types.ObjectId.isValid(matchId)) {
      const error = new Error('matchId inválido');
      error.status = 400;
      throw error;
    }
    const objectId = new mongoose.Types.ObjectId(matchId);
    if (status || group) {
      const matchFilter = { _id: objectId };
      if (status) matchFilter.status = status;
      if (group) matchFilter.group = group;
      const found = await Match.findOne(matchFilter).select('_id').lean();
      return found ? [found._id] : [];
    }
    return [objectId];
  }

  if (!status && !group) return null;

  const matchFilter = {};
  if (status) {
    if (!['upcoming', 'live', 'finished'].includes(status)) {
      const error = new Error('status inválido');
      error.status = 400;
      throw error;
    }
    matchFilter.status = status;
  }
  if (group) matchFilter.group = group;

  const matching = await Match.find(matchFilter).select('_id').lean();
  return matching.map((m) => m._id);
}

export async function listAdminPredictions({
  userId,
  matchId,
  status,
  group,
  scored,
  source,
} = {}) {
  const filter = {};
  if (userId) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      const error = new Error('userId inválido');
      error.status = 400;
      throw error;
    }
    filter.userId = userId;
  }

  const matchIds = await resolvePredictionMatchIds({ matchId, status, group });
  if (matchIds !== null) {
    if (!matchIds.length) return [];
    filter.matchId = matchIds.length === 1 ? matchIds[0] : { $in: matchIds };
  }

  if (scored === 'true') {
    filter.pointsEarned = { $ne: null };
  } else if (scored === 'false') {
    filter.pointsEarned = null;
  }

  if (source) {
    if (!['user', 'ai', 'admin', 'default'].includes(source)) {
      const error = new Error('source inválido');
      error.status = 400;
      throw error;
    }
    filter.predictionSource = source;
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
      bonusPoint: p.bonusPoint ?? 0,
      predictionSource: p.predictionSource ?? 'user',
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

async function serializeAdminPredictionRow(prediction) {
  const populated = await Prediction.findById(prediction._id ?? prediction.id)
    .populate('userId', 'name email')
    .populate(
      'matchId',
      'homeTeamId awayTeamId status homeScore awayScore group kickoffAt externalId'
    )
    .lean();

  if (!populated) return null;

  const teamIds = new Set();
  if (populated.matchId?.homeTeamId) teamIds.add(populated.matchId.homeTeamId);
  if (populated.matchId?.awayTeamId) teamIds.add(populated.matchId.awayTeamId);

  const teams = teamIds.size
    ? await Team.find({ externalId: { $in: [...teamIds] } }).lean()
    : [];
  const teamMap = Object.fromEntries(teams.map((t) => [t.externalId, t]));

  const match = populated.matchId;
  const homeTeam = match ? teamMap[match.homeTeamId] : null;
  const awayTeam = match ? teamMap[match.awayTeamId] : null;

  return {
    id: populated._id.toString(),
    userId: populated.userId?._id?.toString(),
    userName: populated.userId?.name,
    userEmail: populated.userId?.email,
    matchId: match?._id?.toString(),
    homeGoals: populated.homeGoals,
    awayGoals: populated.awayGoals,
    pointsEarned: populated.pointsEarned,
    bonusPoint: populated.bonusPoint ?? 0,
    predictionSource: populated.predictionSource ?? 'user',
    updatedAt: populated.updatedAt,
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
          label: `${teamLabel(homeTeam, match.homeTeamId)} vs ${teamLabel(awayTeam, match.awayTeamId)}`,
        }
      : null,
  };
}

export async function createAdminPrediction({ userId, matchId, homeGoals, awayGoals }) {
  if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(matchId)) {
    const error = new Error('userId o matchId inválido');
    error.status = 400;
    throw error;
  }

  const home = Number(homeGoals);
  const away = Number(awayGoals);
  if (!Number.isFinite(home) || !Number.isFinite(away) || home < 0 || away < 0) {
    const error = new Error('homeGoals y awayGoals deben ser números >= 0');
    error.status = 400;
    throw error;
  }

  const [user, match] = await Promise.all([
    User.findById(userId),
    Match.findById(matchId),
  ]);
  if (!user) {
    const error = new Error('Usuario no encontrado');
    error.status = 404;
    throw error;
  }
  if (!match) {
    const error = new Error('Partido no encontrado');
    error.status = 404;
    throw error;
  }

  const existing = await Prediction.findOne({ userId, matchId });
  if (existing) {
    const error = new Error('Ese usuario ya tiene predicción para ese partido');
    error.status = 409;
    throw error;
  }

  const prediction = await Prediction.create({
    userId,
    matchId,
    homeGoals: Math.floor(home),
    awayGoals: Math.floor(away),
    userSubmitted: true,
    pointsEarned: null,
  });

  if (match.status === 'finished' || match.status === 'live') {
    await recalculateMatchScores(match._id);
  }

  notifyMatchesUpdated({
    reason: 'admin_prediction_created',
    matchId: match._id.toString(),
    userId: prediction.userId.toString(),
  });
  notifyLeaderboardUpdated({ reason: 'admin_prediction_created' });

  return serializeAdminPredictionRow(prediction);
}

export async function updateAdminPrediction(
  predictionId,
  { homeGoals, awayGoals, pointsEarned, bonusPoint }
) {
  const prediction = await Prediction.findById(predictionId);
  if (!prediction) {
    const error = new Error('Predicción no encontrada');
    error.status = 404;
    throw error;
  }

  let goalsChanged = false;
  let pointsManual = false;

  if (homeGoals !== undefined) {
    const home = Number(homeGoals);
    if (!Number.isFinite(home) || home < 0) {
      const error = new Error('homeGoals debe ser un número >= 0');
      error.status = 400;
      throw error;
    }
    prediction.homeGoals = Math.floor(home);
    goalsChanged = true;
    prediction.userSubmitted = true;
  }

  if (awayGoals !== undefined) {
    const away = Number(awayGoals);
    if (!Number.isFinite(away) || away < 0) {
      const error = new Error('awayGoals debe ser un número >= 0');
      error.status = 400;
      throw error;
    }
    prediction.awayGoals = Math.floor(away);
    goalsChanged = true;
    prediction.userSubmitted = true;
  }

  if (pointsEarned !== undefined) {
    if (pointsEarned === null) {
      prediction.pointsEarned = null;
    } else {
      const points = Number(pointsEarned);
      if (!Number.isFinite(points) || points < 0) {
        const error = new Error('pointsEarned debe ser un número >= 0 o null');
        error.status = 400;
        throw error;
      }
      prediction.pointsEarned = Math.floor(points);
    }
    pointsManual = true;
  }

  if (bonusPoint !== undefined) {
    const bonus = Number(bonusPoint);
    if (!Number.isFinite(bonus) || bonus < 0) {
      const error = new Error('bonusPoint debe ser un número >= 0');
      error.status = 400;
      throw error;
    }
    prediction.bonusPoint = Math.floor(bonus);
    pointsManual = true;
  }

  await prediction.save();

  const match = await Match.findById(prediction.matchId);
  if (goalsChanged && match && (match.status === 'finished' || match.status === 'live')) {
    await recalculateMatchScores(match._id);
  } else if (pointsManual) {
    await recalculateUserTotalPoints(prediction.userId);
  }

  if (goalsChanged && match) {
    notifyMatchesUpdated({
      reason: 'admin_prediction_updated',
      matchId: match._id.toString(),
      userId: prediction.userId.toString(),
    });
  }
  if (goalsChanged || pointsManual) {
    notifyLeaderboardUpdated({ reason: 'admin_prediction_updated' });
  }

  return serializeAdminPredictionRow(prediction);
}

export async function deleteAdminPrediction(predictionId) {
  const prediction = await Prediction.findById(predictionId);
  if (!prediction) {
    const error = new Error('Predicción no encontrada');
    error.status = 404;
    throw error;
  }

  const userId = prediction.userId;
  await prediction.deleteOne();
  await recalculateUserTotalPoints(userId);

  return { deleted: true, id: predictionId };
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
