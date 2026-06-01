import { CompetitionGroup } from '../models/CompetitionGroup.js';
import { User } from '../models/User.js';
import { UserGroupMembership } from '../models/UserGroupMembership.js';

export async function listCompetitionGroups() {
  const groups = await CompetitionGroup.find().sort({ name: 1 }).lean();
  return Promise.all([
    ...groups.map(async (group) => ({
      id: group._id.toString(),
      name: group.name,
      description: group.description,
      memberCount: await UserGroupMembership.countDocuments({ groupId: group._id }),
      createdAt: group.createdAt,
    })),
  ]);
}

export async function createCompetitionGroup({ name, description, createdBy = null }) {
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

  const group = await CompetitionGroup.create({
    name: trimmedName,
    description: description?.trim() || '',
    createdBy,
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

  return {
    id: group._id.toString(),
    name: group.name,
    description: group.description,
  };
}

export async function getCompetitionGroupById(groupId) {
  const group = await CompetitionGroup.findById(groupId);
  if (!group) return null;
  return {
    id: group._id.toString(),
    name: group.name,
    description: group.description,
  };
}

export async function joinCompetitionGroup({ userId, groupId }) {
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

export async function updateCompetitionGroup({ groupId, name, description, userId }) {
  const group = await CompetitionGroup.findById(groupId);
  if (!group) {
    const error = new Error('Grupo no encontrado');
    error.status = 404;
    throw error;
  }

  if (group.createdBy && String(group.createdBy) !== String(userId)) {
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
  await group.save();
  return getCompetitionGroupById(group._id);
}

export async function listUserCompetitionGroups(userId) {
  const memberships = await UserGroupMembership.find({ userId }).lean();
  if (!memberships.length) return [];

  const groups = await CompetitionGroup.find({
    _id: { $in: memberships.map((m) => m.groupId) },
  })
    .sort({ name: 1 })
    .lean();

  const roleByGroup = Object.fromEntries(
    memberships.map((membership) => [membership.groupId.toString(), membership.role])
  );

  return groups.map((group) => ({
    id: group._id.toString(),
    name: group.name,
    description: group.description,
    role: roleByGroup[group._id.toString()] || 'member',
  }));
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
