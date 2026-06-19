import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { User } from '../src/models/User.js';
import { UserGroupMembership } from '../src/models/UserGroupMembership.js';
import { CompetitionGroupJoinRequest } from '../src/models/CompetitionGroupJoinRequest.js';
import { CompetitionGroup } from '../src/models/CompetitionGroup.js';
import {
  approveJoinRequest,
  createCompetitionGroup,
  getCompetitionGroupInvitePreview,
  joinCompetitionGroup,
  leaveCompetitionGroup,
  listCompetitionGroupMembers,
  listCompetitionGroups,
  removeGroupMember,
  requestJoinCompetitionGroup,
} from '../src/services/competitionGroupService.js';
import { getTestMongoUri } from '../src/config/testDbGuard.js';

const mongoUri = getTestMongoUri();

describe('competitionGroupService', () => {
  it('valida nombre obligatorio', async () => {
    await expect(createCompetitionGroup({ name: '  ' })).rejects.toMatchObject({
      message: 'El nombre del grupo es obligatorio',
    });
  });

  it('expone listCompetitionGroups como función', () => {
    expect(typeof listCompetitionGroups).toBe('function');
  });

  it('rechaza vista previa de invitación para Sin grupo o id inválido', async () => {
    await expect(getCompetitionGroupInvitePreview('__nogroup')).rejects.toMatchObject({
      status: 404,
    });
    await expect(getCompetitionGroupInvitePreview('not-a-valid-id')).rejects.toMatchObject({
      status: 404,
    });
  });

  describe('multi-grupo', () => {
    let userId;

    beforeAll(async () => {
      if (mongoose.connection.readyState === 0) {
        await mongoose.connect(mongoUri);
      }
      const user = await User.create({
        name: 'Test Leave',
        email: `leave-${Date.now()}@test.local`,
        passwordHash: 'hash',
        balanceFubols: 100,
      });
      userId = user._id;
    });

    afterAll(async () => {
      if (userId) {
        await UserGroupMembership.deleteMany({ userId });
        await User.deleteOne({ _id: userId });
      }
    });

    it('incluye Sin grupo en el listado público', async () => {
      const groups = await listCompetitionGroups();
      expect(groups[0]).toMatchObject({ id: '__nogroup', name: 'Sin grupo', isVirtual: true });
    });

    it('permite salir de un grupo y listar miembros', async () => {
      const group = await createCompetitionGroup({
        name: `Grupo leave ${Date.now()}`,
        createdBy: userId,
        internal: false,
      });

      await joinCompetitionGroup({ userId, groupId: group.id });
      let members = await listCompetitionGroupMembers(group.id);
      expect(members.some((row) => row.email.includes('leave-'))).toBe(true);

      await leaveCompetitionGroup({ userId, groupId: group.id });
      members = await listCompetitionGroupMembers(group.id);
      expect(members.some((row) => row.email.includes('leave-'))).toBe(false);

      const noGroupMembers = await listCompetitionGroupMembers('__nogroup');
      expect(noGroupMembers.some((row) => row.email.includes('leave-'))).toBe(true);
    });

    it('solicitud pendiente no cuenta como miembro hasta aprobar', async () => {
      const owner = await User.create({
        name: 'Owner',
        email: `owner-${Date.now()}@test.local`,
        passwordHash: 'hash',
        balanceFubols: 100,
      });
      const applicant = await User.create({
        name: 'Applicant',
        email: `applicant-${Date.now()}@test.local`,
        passwordHash: 'hash',
        balanceFubols: 100,
      });

      const group = await createCompetitionGroup({
        name: `Grupo request ${Date.now()}`,
        createdBy: owner._id,
        internal: false,
      });

      const pending = await requestJoinCompetitionGroup({
        userId: applicant._id,
        groupId: group.id,
      });
      expect(pending.status).toBe('pending');

      let members = await listCompetitionGroupMembers(group.id);
      expect(members.some((row) => row.email.includes('applicant-'))).toBe(false);

      await approveJoinRequest({
        groupId: group.id,
        targetUserId: applicant._id,
        userId: owner._id,
      });

      members = await listCompetitionGroupMembers(group.id);
      expect(members.some((row) => row.email.includes('applicant-'))).toBe(true);

      await joinCompetitionGroup({ userId: applicant._id, groupId: group.id });
      await removeGroupMember({
        groupId: group.id,
        targetUserId: applicant._id,
        userId: owner._id,
      });
      members = await listCompetitionGroupMembers(group.id);
      expect(members.some((row) => row.email.includes('applicant-'))).toBe(false);

      await CompetitionGroupJoinRequest.deleteMany({
        $or: [{ userId: owner._id }, { userId: applicant._id }],
      });
      await UserGroupMembership.deleteMany({
        $or: [{ userId: owner._id }, { userId: applicant._id }],
      });
      await CompetitionGroup.deleteOne({ _id: group.id });
      await User.deleteMany({ _id: { $in: [owner._id, applicant._id] } });
    });
  });
});
