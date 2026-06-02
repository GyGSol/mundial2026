import mongoose from 'mongoose';
import { CompetitionGroup } from '../models/CompetitionGroup.js';
import { User } from '../models/User.js';
import { UserGroupMembership } from '../models/UserGroupMembership.js';

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

async function isGroupAdmin({ userId, group }) {
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

export async function listCompetitionGroupMembers(groupId) {
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

  const memberUserIds = await UserGroupMembership.find({ groupId: group._id }).distinct('userId');
  if (!memberUserIds.length) return [];

  const users = await User.find({ _id: { $in: memberUserIds } })
    .select('name email')
    .sort({ name: 1 })
    .lean();

  return users.map((user) => ({
    id: user._id.toString(),
    name: user.name,
    email: user.email,
  }));
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
  }

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

  const user = await User.findById(userId).select('activeCompetitionGroupId competitionGroupId');
  const wasActive =
    String(user?.activeCompetitionGroupId || user?.competitionGroupId || '') === String(group._id);

  if (wasActive) {
    const remaining = await UserGroupMembership.findOne({ userId }).sort({ createdAt: 1 }).lean();
    const nextGroupId = remaining?.groupId || null;
    await User.findByIdAndUpdate(userId, {
      $set: {
        activeCompetitionGroupId: nextGroupId,
        competitionGroupId: nextGroupId,
      },
    });
  }

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

  await UserGroupMembership.findOneAndUpdate(
    { userId, groupId: group._id },
    { $setOnInsert: { role: 'member' } },
    { upsert: true, new: true }
  );

  await User.findByIdAndUpdate(userId, {
    $set: {
      activeCompetitionGroupId: group._id,
      competitionGroupId: group._id,
    },
  });

  return getCompetitionGroupById(group._id);
}

export async function updateCompetitionGroup({
  groupId,
  name,
  description,
  userId,
  prizesWinnersCount = 0,
  prizes = [],
}) {
  const group = await CompetitionGroup.findById(groupId);
  if (!group) {
    const error = new Error('Grupo no encontrado');
    error.status = 404;
    throw error;
  }

  if (!(await isGroupAdmin({ userId, group }))) {
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
  if (!group.createdBy) {
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
      isAdmin: isCreator,
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
