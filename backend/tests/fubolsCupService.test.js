import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import mongoose from 'mongoose';
import { User } from '../src/models/User.js';
import { CompetitionGroup } from '../src/models/CompetitionGroup.js';
import { UserGroupMembership } from '../src/models/UserGroupMembership.js';
import { Match } from '../src/models/Match.js';
import { Prediction } from '../src/models/Prediction.js';
import { FubolsCupTournament } from '../src/models/FubolsCupTournament.js';
import { FubolTransaction } from '../src/models/FubolTransaction.js';
import { AppTreasury } from '../src/models/AppTreasury.js';
import {
  getFubolsCupDashboard,
  getHumanLeaderboardTop8,
  processFubolsCupForGroup,
  trySeedFubolsCup,
} from '../src/services/fubolsCupService.js';
import { getTestMongoUri } from '../src/config/testDbGuard.js';
import { FUBOLS_CUP_CHAMPION_PRIZE, FUBOLS_CUP_ROUND_ADVANCE_PRIZE } from '../src/config/economy.js';

const mongoUri = getTestMongoUri();

async function connectTestDb() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(mongoUri);
  }
}

describe('fubolsCupService', () => {
  const cleanup = {
    groupIds: [],
    userIds: [],
    matchIds: [],
  };

  beforeAll(async () => {
    await connectTestDb();
    await AppTreasury.findOneAndUpdate(
      { singletonKey: 'main' },
      { $set: { houseBalanceFubols: 100_000 } },
      { upsert: true }
    );
  }, 30_000);

  afterEach(async () => {
    if (cleanup.groupIds.length) {
      await FubolsCupTournament.deleteMany({ groupId: { $in: cleanup.groupIds } });
      await UserGroupMembership.deleteMany({ groupId: { $in: cleanup.groupIds } });
      await CompetitionGroup.deleteMany({ _id: { $in: cleanup.groupIds } });
    }
    if (cleanup.matchIds.length) {
      await Prediction.deleteMany({ matchId: { $in: cleanup.matchIds } });
      await Match.deleteMany({ _id: { $in: cleanup.matchIds } });
    }
    if (cleanup.userIds.length) {
      await FubolTransaction.deleteMany({ userId: { $in: cleanup.userIds } });
      await User.deleteMany({ _id: { $in: cleanup.userIds } });
    }
    cleanup.groupIds = [];
    cleanup.userIds = [];
    cleanup.matchIds = [];
  });

  async function createHuman(name, points = 10) {
    const user = await User.create({
      name,
      email: `cup-${name}-${Date.now()}-${Math.random()}@test.local`,
      passwordHash: 'hash',
      balanceFubols: 0,
    });
    cleanup.userIds.push(user._id);
    return user;
  }

  async function setupGroupWithHumans(count = 8) {
    const admin = await createHuman('admin');
    const group = await CompetitionGroup.create({
      name: `Cup ${Date.now()}-${Math.random()}`,
      createdBy: admin._id,
    });
    cleanup.groupIds.push(group._id);
    await UserGroupMembership.create({ userId: admin._id, groupId: group._id, role: 'owner' });

    const humans = [admin];
    for (let i = 1; i < count; i += 1) {
      const user = await createHuman(`p${i}`, 20 - i);
      humans.push(user);
      await UserGroupMembership.create({ userId: user._id, groupId: group._id, role: 'member' });
    }

    for (const human of humans) {
      const match = await Match.create({
        externalId: `cup-seed-${human._id}-${Date.now()}`,
        homeTeamId: 'ARG',
        awayTeamId: 'BRA',
        status: 'finished',
        homeScore: 1,
        awayScore: 0,
        finishedAt: new Date(),
      });
      cleanup.matchIds.push(match._id);
      await Prediction.create({
        userId: human._id,
        matchId: match._id,
        homeGoals: 1,
        awayGoals: 0,
        pointsEarned: human.name === 'admin' ? 30 : 20 - humans.indexOf(human),
        pointsBreakdown: { winner: 3, homeGoals: 1, awayGoals: 0, totalGoals: 1 },
      });
    }

    return { groupId: group._id.toString(), admin, humans };
  }

  async function finishRoundOf32() {
    for (let id = 73; id <= 88; id += 1) {
      const match = await Match.create({
        externalId: String(id),
        homeTeamId: 'ARG',
        awayTeamId: 'BRA',
        status: 'finished',
        homeScore: 1,
        awayScore: 0,
        finishedAt: new Date(),
      });
      cleanup.matchIds.push(match._id);
    }
  }

  it('preview devuelve top 8 humanos proyectados', async () => {
    const { groupId, admin } = await setupGroupWithHumans(8);
    const dashboard = await getFubolsCupDashboard(groupId, admin._id);
    expect(dashboard.tournament.status).toBe('preview');
    expect(dashboard.previewTop8).toHaveLength(8);
    expect(dashboard.rounds[0].duels[0].playerA?.name).toBeTruthy();
  });

  it('cancela si hay menos de 8 humanos al cerrar dieciseisavos', async () => {
    const { groupId } = await setupGroupWithHumans(5);
    await finishRoundOf32();
    const tournament = await trySeedFubolsCup(groupId);
    expect(tournament.status).toBe('cancelled');
  });

  it('fija seeds al cerrar dieciseisavos con 8 humanos', async () => {
    const { groupId } = await setupGroupWithHumans(8);
    await finishRoundOf32();
    const tournament = await trySeedFubolsCup(groupId);
    expect(tournament.status).toBe('running');
    expect(tournament.seeds).toHaveLength(8);
  });

  it('resuelve cruce 4-3 y 1-3 a favor de B', async () => {
    const { groupId, humans } = await setupGroupWithHumans(8);
    await finishRoundOf32();
    await trySeedFubolsCup(groupId);

    const playerA = humans[0];
    const playerB = humans[7];

    for (const externalId of ['89', '90']) {
      const match = await Match.findOneAndUpdate(
        { externalId },
        {
          externalId,
          homeTeamId: 'ARG',
          awayTeamId: 'BRA',
          status: 'finished',
          homeScore: 2,
          awayScore: 1,
          finishedAt: new Date(),
        },
        { upsert: true, new: true }
      );
      cleanup.matchIds.push(match._id);
      const pointsA = externalId === '89' ? 4 : 1;
      const pointsB = externalId === '89' ? 3 : 3;
      for (const [user, pts] of [
        [playerA, pointsA],
        [playerB, pointsB],
      ]) {
        await Prediction.findOneAndUpdate(
          { userId: user._id, matchId: match._id },
          {
            userId: user._id,
            matchId: match._id,
            homeGoals: 2,
            awayGoals: 1,
            pointsEarned: pts,
            pointsBreakdown: { winner: 3, homeGoals: 0, awayGoals: 0, totalGoals: 0 },
          },
          { upsert: true }
        );
      }
    }

    const treasuryBefore =
      (await AppTreasury.findOne({ singletonKey: 'main' }))?.houseBalanceFubols ?? 0;
    await processFubolsCupForGroup(groupId);
    const tournament = await FubolsCupTournament.findOne({ groupId });
    const duel = tournament.rounds[0].duels[0];
    expect(String(duel.winnerId)).toBe(String(playerB._id));

    const advanceTx = await FubolTransaction.findOne({
      userId: playerB._id,
      type: 'prize_payout',
      idempotencyKey: `fubols-cup-advance:${groupId}:round_of_16:round_of_16:0`,
    });
    expect(advanceTx?.amount).toBe(FUBOLS_CUP_ROUND_ADVANCE_PRIZE);
    const treasuryAfter =
      (await AppTreasury.findOne({ singletonKey: 'main' }))?.houseBalanceFubols ?? 0;
    expect(treasuryAfter).toBe(treasuryBefore - FUBOLS_CUP_ROUND_ADVANCE_PRIZE);
  });

  it('getHumanLeaderboardTop8 excluye IA', async () => {
    const { groupId } = await setupGroupWithHumans(7);
    const ai = await User.create({
      name: 'IA Bot',
      email: `ai-${Date.now()}@test.local`,
      passwordHash: 'hash',
      isAiUser: true,
    });
    cleanup.userIds.push(ai._id);
    await UserGroupMembership.create({
      userId: ai._id,
      groupId: cleanup.groupIds[0],
      role: 'member',
    });
    const top = await getHumanLeaderboardTop8(groupId);
    expect(top.every((row) => !row.isAiUser)).toBe(true);
    expect(top.length).toBeLessThanOrEqual(8);
  });
});
