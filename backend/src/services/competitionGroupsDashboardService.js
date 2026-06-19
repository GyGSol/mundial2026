import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { CompetitionGroup } from '../models/CompetitionGroup.js';
import { CompetitionGroupJoinRequest } from '../models/CompetitionGroupJoinRequest.js';
import { UserGroupMembership } from '../models/UserGroupMembership.js';
import {
  listCompetitionGroups,
  listUserCompetitionGroups,
  listUserPendingJoinRequests,
} from './competitionGroupService.js';
import { listEnrollmentsByUserGroups } from './tournamentEnrollmentService.js';

function membershipRoleForUser(group, membership, userId) {
  if (group.createdBy && String(group.createdBy) === String(userId)) return 'owner';
  return membership?.role || 'member';
}

async function batchAdminGroupDetails(adminGroupIds, userId) {
  const validIds = adminGroupIds.filter(
    (id) => id !== '__nogroup' && mongoose.Types.ObjectId.isValid(id)
  );
  if (!validIds.length) {
    return { joinRequests: {}, members: {} };
  }

  const objectIds = validIds.map((id) => new mongoose.Types.ObjectId(id));
  const groups = await CompetitionGroup.find({ _id: { $in: objectIds } }).lean();
  const groupById = Object.fromEntries(groups.map((g) => [g._id.toString(), g]));

  const [requests, memberships] = await Promise.all([
    CompetitionGroupJoinRequest.find({
      groupId: { $in: objectIds },
      status: 'pending',
    })
      .sort({ createdAt: 1 })
      .lean(),
    UserGroupMembership.find({ groupId: { $in: objectIds } }).lean(),
  ]);

  const userIds = new Set();
  for (const request of requests) userIds.add(request.userId.toString());
  for (const membership of memberships) userIds.add(membership.userId.toString());

  const users = userIds.size
    ? await User.find({ _id: { $in: [...userIds] } })
        .select('name email')
        .lean()
    : [];
  const userById = Object.fromEntries(users.map((user) => [user._id.toString(), user]));

  const joinRequests = Object.fromEntries(validIds.map((id) => [id, []]));
  for (const request of requests) {
    const groupId = request.groupId.toString();
    const user = userById[request.userId.toString()];
    joinRequests[groupId].push({
      userId: request.userId.toString(),
      name: user?.name || '',
      email: user?.email || '',
      requestedAt: request.createdAt,
    });
  }

  const membershipsByGroup = new Map();
  for (const membership of memberships) {
    const groupId = membership.groupId.toString();
    if (!membershipsByGroup.has(groupId)) membershipsByGroup.set(groupId, []);
    membershipsByGroup.get(groupId).push(membership);
  }

  const members = {};
  for (const groupId of validIds) {
    const group = groupById[groupId];
    const groupMemberships = membershipsByGroup.get(groupId) ?? [];
    const roleByUser = Object.fromEntries(
      groupMemberships.map((membership) => [
        membership.userId.toString(),
        membershipRoleForUser(group, membership, userId),
      ])
    );

    members[groupId] = groupMemberships
      .map((membership) => {
        const user = userById[membership.userId.toString()];
        return {
          id: membership.userId.toString(),
          name: user?.name || '',
          email: user?.email || '',
          role: roleByUser[membership.userId.toString()] || 'member',
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  return { joinRequests, members };
}

export async function getCompetitionGroupsPage(userId) {
  const groupsPromise = listCompetitionGroups();

  if (!userId) {
    return {
      groups: await groupsPromise,
      myGroups: [],
      pendingGroupIds: [],
      joinRequests: {},
      members: {},
      tournamentEnrollments: {},
    };
  }

  const [groups, myGroups, pendingGroupIds] = await Promise.all([
    groupsPromise,
    listUserCompetitionGroups(userId),
    listUserPendingJoinRequests(userId),
  ]);

  const adminGroupIds = myGroups.filter((group) => group.isAdmin).map((group) => group.id);
  const myGroupIds = myGroups.map((group) => group.id);
  const [adminDetails, tournamentEnrollments] = await Promise.all([
    batchAdminGroupDetails(adminGroupIds, userId),
    listEnrollmentsByUserGroups(userId, myGroupIds),
  ]);
  const { joinRequests, members } = adminDetails;

  return {
    groups,
    myGroups,
    pendingGroupIds,
    joinRequests,
    members,
    tournamentEnrollments,
  };
}
