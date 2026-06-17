import mongoose from 'mongoose';
import { CompetitionGroup } from '../models/CompetitionGroup.js';
import { CompetitionGroupJoinRequest } from '../models/CompetitionGroupJoinRequest.js';
import { User } from '../models/User.js';
import { UserGroupMembership } from '../models/UserGroupMembership.js';
import {
  maybeActivateGroupForUser,
  reassignActiveGroupAfterLeave,
} from './competitionGroupJoinHelpers.js';
import { chargeGroupEntryFee } from './fubolService.js';
import { ensureAiCompetitorInGroup } from './aiGroupMembershipService.js';
import { syncPrizePoolDistribution } from './prizePoolService.js';

function normalizePrizes({ winnersCount, prizes = [] }) {
  const count = Math.max(0, Math.min(Number(winnersCount || 0), 10));
  const rawByPosition = new Map(
    (Array.isArray(prizes) ? prizes : [])
      .filter((item) => Number.isInteger(Number(item?.position)))
      .map((item) => [Number(item.position), String(item?.prize || '').trim()])
  );

  const normalized = [];
  for (let position = 1; position <= count; position += 1) {
    normalized.push({
      position,
      prize: rawByPosition.get(position) || '',
    });
  }
  return { winnersCount: count, prizes: normalized };
}

function serializeGroup(group) {
  return {
    id: group._id.toString(),
    name: group.name,
    description: group.description,
    prizesWinnersCount: group.prizesWinnersCount || 0,
    prizes: (group.prizes || [])
      .sort((a, b) => a.position - b.position)
      .map((row) => ({ position: row.position, prize: row.prize || '' })),
  };
}

export async function isGroupAdmin({ userId, group }) {
  if (group.createdBy && String(group.createdBy) === String(userId)) return true;
  if (!group.createdBy) {
    // Legacy groups created before admin tracking: any current member can claim admin on first edit.
    const membership = await UserGroupMembership.findOne({ userId, groupId: group._id });
    return Boolean(membership);
  }
  const ownerMembership = await UserGroupMembership.findOne({
    userId,
    groupId: group._id,
    role: 'owner',
  });
  return Boolean(ownerMembership);
}

export async function countNoGroupMembers() {
  const memberUserIds = await UserGroupMembership.distinct('userId');
  return User.countDocuments({ _id: { $nin: memberUserIds } });
}

function buildNoGroupEntry(memberCount) {
  return {
    id: '__nogroup',
    name: 'Sin grupo',
    description: 'Jugadores registrados que no participan en ningún grupo de competencia.',
    prizesWinnersCount: 0,
    prizes: [],
    memberCount,
    isVirtual: true,
    createdAt: null,
  };
}

export async function listCompetitionGroups() {
  const [noGroupCount, groups] = await Promise.all([
    countNoGroupMembers(),
    CompetitionGroup.find().sort({ name: 1 }).lean(),
  ]);

  const serialized = await Promise.all(
    groups.map(async (group) => ({
      ...serializeGroup(group),
      memberCount: await UserGroupMembership.countDocuments({ groupId: group._id }),
      isVirtual: false,
      createdAt: group.createdAt,
    }))
  );

  return [buildNoGroupEntry(noGroupCount), ...serialized];
}

function membershipRoleForUser(group, membership, userId) {
  if (group.createdBy && String(group.createdBy) === String(userId)) return 'owner';
  return membership?.role || 'member';
}

export async function listCompetitionGroupMembers(groupId, { includeRoles = false } = {}) {
  if (groupId === '__nogroup') {
    const memberUserIds = await UserGroupMembership.distinct('userId');
    const users = await User.find({ _id: { $nin: memberUserIds } })
      .select('name email')
      .sort({ name: 1 })
      .lean();
    return users.map((user) => ({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
    }));
  }

  const group = await CompetitionGroup.findById(groupId);
  if (!group) {
    const error = new Error('Grupo no encontrado');
    error.status = 404;
    throw error;
  }

  const memberships = await UserGroupMembership.find({ groupId: group._id }).lean();
  if (!memberships.length) return [];

  const roleByUser = Object.fromEntries(
    memberships.map((m) => [m.userId.toString(), membershipRoleForUser(group, m, m.userId)])
  );
  const memberUserIds = memberships.map((m) => m.userId);

  const users = await User.find({ _id: { $in: memberUserIds } })
    .select('name email')
    .sort({ name: 1 })
    .lean();

  return users.map((user) => {
    const row = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
    };
    if (includeRoles) {
      row.role = roleByUser[user._id.toString()] || 'member';
    }
    return row;
  });
}

export async function createCompetitionGroup({
  name,
  description,
  createdBy = null,
  prizesWinnersCount = 0,
  prizes = [],
  /** Grupos creados por el motor de simulación (sin usuario humano). */
  internal = false,
}) {
  const trimmedName = name?.trim();
  if (!trimmedName) {
    const error = new Error('El nombre del grupo es obligatorio');
    error.status = 400;
    throw error;
  }

  const existing = await CompetitionGroup.findOne({ name: trimmedName });
  if (existing) {
    const error = new Error('Ya existe un grupo con ese nombre');
    error.status = 409;
    throw error;
  }

  if (!createdBy && !internal) {
    const error = new Error('Debés iniciar sesión para crear grupos');
    error.status = 401;
    throw error;
  }

  const normalizedPrizes = normalizePrizes({ winnersCount: prizesWinnersCount, prizes });
  const group = await CompetitionGroup.create({
    name: trimmedName,
    description: description?.trim() || '',
    createdBy,
    prizesWinnersCount: normalizedPrizes.winnersCount,
    prizes: normalizedPrizes.prizes,
  });

  if (createdBy) {
    await UserGroupMembership.findOneAndUpdate(
      { userId: createdBy, groupId: group._id },
      { $set: { role: 'owner' } },
      { upsert: true, new: true }
    );

    await User.findByIdAndUpdate(createdBy, {
      $set: {
        activeCompetitionGroupId: group._id,
        competitionGroupId: group._id,
      },
    });

    await chargeGroupEntryFee({ userId: createdBy, groupId: group._id });
  }

  await syncPrizePoolDistribution(group._id, normalizedPrizes.winnersCount);
  await ensureAiCompetitorInGroup(group._id);

  return serializeGroup(group);
}

export async function getCompetitionGroupById(groupId) {
  const group = await CompetitionGroup.findById(groupId);
  if (!group) return null;
  return serializeGroup(group);
}

export async function getCompetitionGroupInvitePreview(groupId) {
  if (groupId === '__nogroup' || !mongoose.Types.ObjectId.isValid(groupId)) {
    const error = new Error('Grupo no encontrado');
    error.status = 404;
    throw error;
  }

  const group = await CompetitionGroup.findById(groupId);
  if (!group) {
    const error = new Error('Grupo no encontrado');
    error.status = 404;
    throw error;
  }

  const memberCount = await UserGroupMembership.countDocuments({ groupId: group._id });

  return {
    ...serializeGroup(group),
    memberCount,
  };
}

export async function leaveCompetitionGroup({ userId, groupId }) {
  if (groupId === '__nogroup') {
    const error = new Error('No podés salir del grupo Sin grupo');
    error.status = 400;
    throw error;
  }

  const group = await CompetitionGroup.findById(groupId);
  if (!group) {
    const error = new Error('Grupo no encontrado');
    error.status = 404;
    throw error;
  }

  const membership = await UserGroupMembership.findOne({ userId, groupId: group._id });
  if (!membership) {
    const error = new Error('No participás en ese grupo');
    error.status = 404;
    throw error;
  }

  await UserGroupMembership.deleteOne({ _id: membership._id });
  await CompetitionGroupJoinRequest.deleteMany({ userId, groupId: group._id });
  await reassignActiveGroupAfterLeave(userId, group._id);

  return { left: true, groupId: group._id.toString() };
}

export async function joinCompetitionGroup({ userId, groupId }) {
  if (groupId === '__nogroup') {
    const error = new Error('No podés unirte al grupo Sin grupo');
    error.status = 400;
    throw error;
  }

  const group = await CompetitionGroup.findById(groupId);
  if (!group) {
    const error = new Error('Grupo no encontrado');
    error.status = 404;
    throw error;
  }

  await chargeGroupEntryFee({ userId, groupId: group._id });

  await UserGroupMembership.findOneAndUpdate(
    { userId, groupId: group._id },
    { $setOnInsert: { role: 'member' } },
    { upsert: true, new: true }
  );

  await maybeActivateGroupForUser(userId, group._id);
  await User.findByIdAndUpdate(userId, {
    $set: {
      activeCompetitionGroupId: group._id,
      competitionGroupId: group._id,
    },
  });

  await CompetitionGroupJoinRequest.deleteMany({ userId, groupId: group._id });

  return getCompetitionGroupById(group._id);
}

export async function requestJoinCompetitionGroup({ userId, groupId }) {
  if (groupId === '__nogroup') {
    const error = new Error('No podés solicitar unirte al grupo Sin grupo');
    error.status = 400;
    throw error;
  }

  const group = await CompetitionGroup.findById(groupId);
  if (!group) {
    const error = new Error('Grupo no encontrado');
    error.status = 404;
    throw error;
  }

  const existingMembership = await UserGroupMembership.findOne({ userId, groupId: group._id });
  if (existingMembership) {
    const error = new Error('Ya participás en este grupo');
    error.status = 409;
    throw error;
  }

  const existingRequest = await CompetitionGroupJoinRequest.findOne({
    userId,
    groupId: group._id,
  });

  if (existingRequest?.status === 'pending') {
    return { status: 'pending', group: await getCompetitionGroupById(group._id) };
  }

  await CompetitionGroupJoinRequest.findOneAndUpdate(
    { userId, groupId: group._id },
    { $set: { status: 'pending' } },
    { upsert: true, new: true }
  );

  return { status: 'pending', group: await getCompetitionGroupById(group._id) };
}

export async function listUserPendingJoinRequests(userId) {
  const requests = await CompetitionGroupJoinRequest.find({ userId, status: 'pending' }).lean();
  return requests.map((r) => r.groupId.toString());
}

/** Solicitudes de ingreso pendientes en grupos donde el usuario es administrador. */
export async function countPendingApprovalsForUser(userId) {
  const myGroups = await listUserCompetitionGroups(userId);
  const adminGroupIds = myGroups.filter((g) => g.isAdmin).map((g) => g.id);
  if (!adminGroupIds.length) return 0;

  return CompetitionGroupJoinRequest.countDocuments({
    groupId: { $in: adminGroupIds.map((id) => new mongoose.Types.ObjectId(id)) },
    status: 'pending',
  });
}

export async function listGroupJoinRequests({ groupId, userId, adminOverride = false }) {
  const group = await CompetitionGroup.findById(groupId);
  if (!group) {
    const error = new Error('Grupo no encontrado');
    error.status = 404;
    throw error;
  }

  if (!adminOverride && !(await isGroupAdmin({ userId, group }))) {
    const error = new Error('Solo el administrador puede ver solicitudes');
    error.status = 403;
    throw error;
  }

  const requests = await CompetitionGroupJoinRequest.find({
    groupId: group._id,
    status: 'pending',
  })
    .sort({ createdAt: 1 })
    .lean();

  if (!requests.length) return [];

  const users = await User.find({ _id: { $in: requests.map((r) => r.userId) } })
    .select('name email')
    .lean();
  const userById = Object.fromEntries(users.map((u) => [u._id.toString(), u]));

  return requests.map((r) => {
    const user = userById[r.userId.toString()];
    return {
      userId: r.userId.toString(),
      name: user?.name || '',
      email: user?.email || '',
      requestedAt: r.createdAt,
    };
  });
}

async function addMemberToGroup({ userId, group }) {
  await UserGroupMembership.findOneAndUpdate(
    { userId, groupId: group._id },
    { $setOnInsert: { role: 'member' } },
    { upsert: true, new: true }
  );
  await CompetitionGroupJoinRequest.deleteMany({ userId, groupId: group._id });
  await maybeActivateGroupForUser(userId, group._id);
}

export async function approveJoinRequest({
  groupId,
  targetUserId,
  userId,
  adminOverride = false,
}) {
  const group = await CompetitionGroup.findById(groupId);
  if (!group) {
    const error = new Error('Grupo no encontrado');
    error.status = 404;
    throw error;
  }

  if (!adminOverride && !(await isGroupAdmin({ userId, group }))) {
    const error = new Error('Solo el administrador puede aprobar solicitudes');
    error.status = 403;
    throw error;
  }

  const request = await CompetitionGroupJoinRequest.findOne({
    groupId: group._id,
    userId: targetUserId,
    status: 'pending',
  });

  if (!request) {
    const error = new Error('No hay solicitud pendiente para este usuario');
    error.status = 404;
    throw error;
  }

  await chargeGroupEntryFee({ userId: targetUserId, groupId: group._id });

  await addMemberToGroup({ userId: targetUserId, group });
  return { approved: true, userId: String(targetUserId) };
}

export async function rejectJoinRequest({
  groupId,
  targetUserId,
  userId,
  adminOverride = false,
}) {
  const group = await CompetitionGroup.findById(groupId);
  if (!group) {
    const error = new Error('Grupo no encontrado');
    error.status = 404;
    throw error;
  }

  if (!adminOverride && !(await isGroupAdmin({ userId, group }))) {
    const error = new Error('Solo el administrador puede rechazar solicitudes');
    error.status = 403;
    throw error;
  }

  const result = await CompetitionGroupJoinRequest.findOneAndUpdate(
    { groupId: group._id, userId: targetUserId, status: 'pending' },
    { $set: { status: 'rejected' } },
    { new: true }
  );

  if (!result) {
    const error = new Error('No hay solicitud pendiente para este usuario');
    error.status = 404;
    throw error;
  }

  return { rejected: true, userId: String(targetUserId) };
}

export async function removeGroupMember({
  groupId,
  targetUserId,
  userId,
  adminOverride = false,
}) {
  const group = await CompetitionGroup.findById(groupId);
  if (!group) {
    const error = new Error('Grupo no encontrado');
    error.status = 404;
    throw error;
  }

  if (!adminOverride && !(await isGroupAdmin({ userId, group }))) {
    const error = new Error('Solo el administrador puede expulsar miembros');
    error.status = 403;
    throw error;
  }

  if (String(targetUserId) === String(userId) && !adminOverride) {
    const error = new Error('Usá Salir para abandonar el grupo');
    error.status = 403;
    throw error;
  }

  const isOwner =
    (group.createdBy && String(group.createdBy) === String(targetUserId)) ||
    Boolean(
      await UserGroupMembership.findOne({
        userId: targetUserId,
        groupId: group._id,
        role: 'owner',
      })
    );

  if (isOwner) {
    const error = new Error('No podés expulsar al administrador del grupo');
    error.status = 403;
    throw error;
  }

  const membership = await UserGroupMembership.findOne({
    userId: targetUserId,
    groupId: group._id,
  });

  if (!membership) {
    const error = new Error('Este usuario no participa en el grupo');
    error.status = 404;
    throw error;
  }

  await UserGroupMembership.deleteOne({ _id: membership._id });
  await CompetitionGroupJoinRequest.deleteMany({ userId: targetUserId, groupId: group._id });
  await reassignActiveGroupAfterLeave(targetUserId, group._id);

  return { removed: true, userId: String(targetUserId) };
}

export async function addGroupMemberDirect({
  groupId,
  targetUserId,
  adminOverride = false,
  actorUserId = null,
}) {
  const group = await CompetitionGroup.findById(groupId);
  if (!group) {
    const error = new Error('Grupo no encontrado');
    error.status = 404;
    throw error;
  }

  if (!adminOverride && actorUserId) {
    if (!(await isGroupAdmin({ userId: actorUserId, group }))) {
      const error = new Error('Solo el administrador puede agregar miembros');
      error.status = 403;
      throw error;
    }
  } else if (!adminOverride) {
    const error = new Error('No autorizado');
    error.status = 403;
    throw error;
  }

  const targetUser = await User.findById(targetUserId);
  if (!targetUser) {
    const error = new Error('Usuario no encontrado');
    error.status = 404;
    throw error;
  }

  await addMemberToGroup({ userId: targetUserId, group });
  return { added: true, userId: String(targetUserId) };
}

export async function updateCompetitionGroup({
  groupId,
  name,
  description,
  userId,
  prizesWinnersCount = 0,
  prizes = [],
  adminOverride = false,
}) {
  const group = await CompetitionGroup.findById(groupId);
  if (!group) {
    const error = new Error('Grupo no encontrado');
    error.status = 404;
    throw error;
  }

  if (!adminOverride && !(await isGroupAdmin({ userId, group }))) {
    const error = new Error('Solo el creador puede editar el grupo');
    error.status = 403;
    throw error;
  }

  const trimmedName = name?.trim();
  if (!trimmedName) {
    const error = new Error('El nombre del grupo es obligatorio');
    error.status = 400;
    throw error;
  }

  const existing = await CompetitionGroup.findOne({
    _id: { $ne: group._id },
    name: trimmedName,
  });
  if (existing) {
    const error = new Error('Ya existe un grupo con ese nombre');
    error.status = 409;
    throw error;
  }

  group.name = trimmedName;
  group.description = description?.trim() || '';
  if (!group.createdBy && userId) {
    // Claim admin ownership for legacy groups without explicit creator.
    group.createdBy = userId;
    await UserGroupMembership.findOneAndUpdate(
      { userId, groupId: group._id },
      { $set: { role: 'owner' } },
      { upsert: true }
    );
  }
  const normalizedPrizes = normalizePrizes({ winnersCount: prizesWinnersCount, prizes });
  group.prizesWinnersCount = normalizedPrizes.winnersCount;
  group.prizes = normalizedPrizes.prizes;
  await group.save();
  await syncPrizePoolDistribution(group._id, normalizedPrizes.winnersCount);
  return getCompetitionGroupById(group._id);
}

export async function listUserCompetitionGroups(userId) {
  let memberships = await UserGroupMembership.find({ userId }).lean();
  if (!memberships.length) {
    // Legacy bootstrap for users created before multi-group memberships.
    const user = await User.findById(userId).select('competitionGroupId');
    if (user?.competitionGroupId) {
      await UserGroupMembership.findOneAndUpdate(
        { userId, groupId: user.competitionGroupId },
        { $setOnInsert: { role: 'member' } },
        { upsert: true }
      );
      memberships = await UserGroupMembership.find({ userId }).lean();
    }
  }
  if (!memberships.length) return [];

  const groups = await CompetitionGroup.find({
    _id: { $in: memberships.map((m) => m.groupId) },
  })
    .sort({ name: 1 })
    .lean();

  const roleByGroup = Object.fromEntries(
    memberships.map((membership) => [membership.groupId.toString(), membership.role])
  );

  return groups.map((group) => {
    const isCreator = group.createdBy && String(group.createdBy) === String(userId);
    const membershipRole = roleByGroup[group._id.toString()];
    const role = isCreator ? 'owner' : membershipRole || 'member';

    if (isCreator && membershipRole !== 'owner') {
      void UserGroupMembership.updateOne(
        { userId, groupId: group._id },
        { $set: { role: 'owner' } }
      );
    }

    return {
      ...serializeGroup(group),
      role,
      isAdmin: role === 'owner',
    };
  });
}

export async function setActiveCompetitionGroup({ userId, groupId }) {
  const membership = await UserGroupMembership.findOne({ userId, groupId });
  if (!membership) {
    const error = new Error('No participás en ese grupo');
    error.status = 403;
    throw error;
  }

  const group = await CompetitionGroup.findById(groupId);
  if (!group) {
    const error = new Error('Grupo no encontrado');
    error.status = 404;
    throw error;
  }

  await User.findByIdAndUpdate(userId, {
    $set: {
      activeCompetitionGroupId: group._id,
      competitionGroupId: group._id,
    },
  });

  return getCompetitionGroupById(group._id);
}

export async function deleteCompetitionGroup({ groupId, userId, adminOverride = false }) {
  const group = await CompetitionGroup.findById(groupId);
  if (!group) {
    const error = new Error('Grupo no encontrado');
    error.status = 404;
    throw error;
  }

  if (!adminOverride && !(await isGroupAdmin({ userId, group }))) {
    const error = new Error('Solo el administrador puede eliminar el grupo');
    error.status = 403;
    throw error;
  }

  const memberUserIds = await UserGroupMembership.find({ groupId: group._id }).distinct('userId');

  await UserGroupMembership.deleteMany({ groupId: group._id });
  await CompetitionGroupJoinRequest.deleteMany({ groupId: group._id });

  for (const memberUserId of memberUserIds) {
    const remainingMembership = await UserGroupMembership.findOne({ userId: memberUserId })
      .sort({ createdAt: 1 })
      .lean();
    const nextGroupId = remainingMembership?.groupId || null;
    await User.findByIdAndUpdate(memberUserId, {
      $set: {
        activeCompetitionGroupId: nextGroupId,
        competitionGroupId: nextGroupId,
      },
    });
  }

  await CompetitionGroup.deleteOne({ _id: group._id });

  return { deleted: true, groupId };
}
