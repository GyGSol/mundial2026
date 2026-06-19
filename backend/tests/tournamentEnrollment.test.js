import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { User } from '../src/models/User.js';
import { UserGroupMembership } from '../src/models/UserGroupMembership.js';
import { TournamentEnrollment } from '../src/models/TournamentEnrollment.js';
import { CompetitionGroup } from '../src/models/CompetitionGroup.js';
import { createCompetitionGroup, joinCompetitionGroup } from '../src/services/competitionGroupService.js';
import {
  enrollUser,
  listEnrollmentsForUserInGroup,
} from '../src/services/tournamentEnrollmentService.js';
import { getTestMongoUri } from '../src/config/testDbGuard.js';

const mongoUri = getTestMongoUri();

describe('tournamentEnrollmentService', () => {
  let ownerId;
  let memberId;
  let outsiderId;
  let groupId;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }

    const owner = await User.create({
      name: 'Tournament Owner',
      email: `tournament-owner-${Date.now()}@test.local`,
      passwordHash: 'hash',
      balanceFubols: 100,
    });
    const member = await User.create({
      name: 'Tournament Member',
      email: `tournament-member-${Date.now()}@test.local`,
      passwordHash: 'hash',
      balanceFubols: 100,
    });
    const outsider = await User.create({
      name: 'Tournament Outsider',
      email: `tournament-outsider-${Date.now()}@test.local`,
      passwordHash: 'hash',
      balanceFubols: 100,
    });

    ownerId = owner._id;
    memberId = member._id;
    outsiderId = outsider._id;

    const group = await createCompetitionGroup({
      name: `Torneos test ${Date.now()}`,
      createdBy: ownerId,
      internal: false,
    });
    groupId = group.id;

    await joinCompetitionGroup({ userId: memberId, groupId });
  });

  afterAll(async () => {
    if (groupId) {
      await TournamentEnrollment.deleteMany({ groupId });
      await UserGroupMembership.deleteMany({ groupId });
      await CompetitionGroup.deleteOne({ _id: groupId });
    }
    const userIds = [ownerId, memberId, outsiderId].filter(Boolean);
    if (userIds.length) {
      await TournamentEnrollment.deleteMany({ userId: { $in: userIds } });
      await User.deleteMany({ _id: { $in: userIds } });
    }
  });

  it('rechaza inscripción si no es miembro del grupo', async () => {
    await expect(
      enrollUser(outsiderId, groupId, 'challenge')
    ).rejects.toMatchObject({ status: 403 });
  });

  it('rechaza tipo de torneo inválido', async () => {
    await expect(enrollUser(memberId, groupId, 'common')).rejects.toMatchObject({
      status: 400,
    });
  });

  it('inscribe y lista enrollments del grupo', async () => {
    const enrollment = await enrollUser(memberId, groupId, 'challenge');
    expect(enrollment).toMatchObject({
      groupId,
      tournamentType: 'challenge',
    });
    expect(enrollment.enrolledAt).toBeTruthy();

    const enrollments = await listEnrollmentsForUserInGroup(memberId, groupId);
    expect(enrollments).toHaveLength(1);
    expect(enrollments[0].tournamentType).toBe('challenge');
  });

  it('es idempotente al reinscribirse', async () => {
    const first = await enrollUser(memberId, groupId, 'elimination');
    const second = await enrollUser(memberId, groupId, 'elimination');
    expect(second.tournamentType).toBe('elimination');
    expect(second.enrolledAt).toEqual(first.enrolledAt);

    const enrollments = await listEnrollmentsForUserInGroup(memberId, groupId);
    expect(enrollments.map((row) => row.tournamentType).sort()).toEqual(['challenge', 'elimination']);
  });
});
