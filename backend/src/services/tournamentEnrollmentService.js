import mongoose from 'mongoose';
import { isEnrollableTournamentType } from '../constants/tournamentTypes.js';
import { CompetitionGroup } from '../models/CompetitionGroup.js';
import { TournamentEnrollment } from '../models/TournamentEnrollment.js';
import { UserGroupMembership } from '../models/UserGroupMembership.js';

function serializeEnrollment(row) {
  return {
    groupId: row.groupId.toString(),
    tournamentType: row.tournamentType,
    enrolledAt: row.enrolledAt,
  };
}

async function assertGroupMember(userId, groupId) {
  if (!mongoose.Types.ObjectId.isValid(groupId)) {
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

  const membership = await UserGroupMembership.findOne({ userId, groupId: group._id });
  if (!membership) {
    const error = new Error('Debés ser miembro del grupo para inscribirte');
    error.status = 403;
    throw error;
  }

  return group;
}

export async function listEnrollmentsForUserInGroup(userId, groupId) {
  await assertGroupMember(userId, groupId);

  const rows = await TournamentEnrollment.find({
    userId,
    groupId: new mongoose.Types.ObjectId(groupId),
  })
    .sort({ tournamentType: 1 })
    .lean();

  return rows.map(serializeEnrollment);
}

export async function listEnrollmentsForUser(userId, groupId) {
  if (groupId) {
    return listEnrollmentsForUserInGroup(userId, groupId);
  }

  const rows = await TournamentEnrollment.find({ userId }).sort({ groupId: 1, tournamentType: 1 }).lean();
  return rows.map(serializeEnrollment);
}

export async function listEnrollmentsByUserGroups(userId, groupIds = []) {
  if (!userId || !groupIds.length) return {};

  const validIds = groupIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (!validIds.length) return {};

  const objectIds = validIds.map((id) => new mongoose.Types.ObjectId(id));
  const rows = await TournamentEnrollment.find({
    userId,
    groupId: { $in: objectIds },
  }).lean();

  const byGroupId = Object.fromEntries(validIds.map((id) => [id, []]));
  for (const row of rows) {
    const groupId = row.groupId.toString();
    if (!byGroupId[groupId]) byGroupId[groupId] = [];
    byGroupId[groupId].push(row.tournamentType);
  }

  return byGroupId;
}

export async function enrollUser(userId, groupId, tournamentType) {
  if (!isEnrollableTournamentType(tournamentType)) {
    const error = new Error('Tipo de torneo inválido');
    error.status = 400;
    throw error;
  }

  const group = await assertGroupMember(userId, groupId);

  const enrollment = await TournamentEnrollment.findOneAndUpdate(
    {
      userId,
      groupId: group._id,
      tournamentType,
    },
    {
      $setOnInsert: {
        enrolledAt: new Date(),
      },
    },
    { upsert: true, new: true }
  );

  return serializeEnrollment(enrollment);
}
