import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { User } from '../src/models/User.js';
import { UserGroupMembership } from '../src/models/UserGroupMembership.js';
import {
  createCompetitionGroup,
  getCompetitionGroupInvitePreview,
  joinCompetitionGroup,
  leaveCompetitionGroup,
  listCompetitionGroupMembers,
  listCompetitionGroups,
} from '../src/services/competitionGroupService.js';

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
        await mongoose.connect(
          process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mundial2026-test'
        );
      }
      const user = await User.create({
        name: 'Test Leave',
        email: `leave-${Date.now()}@test.local`,
        passwordHash: 'hash',
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
  });
});
