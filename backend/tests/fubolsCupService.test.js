import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import mongoose from 'mongoose';
import { User } from '../src/models/User.js';
import { CompetitionGroup } from '../src/models/CompetitionGroup.js';
import { UserGroupMembership } from '../src/models/UserGroupMembership.js';
import { Match } from '../src/models/Match.js';
import { Team } from '../src/models/Team.js';
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

function sortExternalIds(ids) {
  return [...ids].sort((a, b) => Number(a) - Number(b));
}

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

    const semiRound = tournament.rounds.find((r) => r.roundKey === 'semi_final');
    const finalRound = tournament.rounds.find((r) => r.roundKey === 'final');
    expect(sortExternalIds(semiRound.worldCupExternalIds)).toEqual(['97', '98', '99', '100']);
    expect(semiRound.duels.every((d) => d.worldCupExternalIds?.length === 2)).toBe(true);
    expect(sortExternalIds(finalRound.worldCupExternalIds)).toEqual(['101', '102', '104']);
    expect(finalRound.duels[0].worldCupExternalIds).toEqual(['101', '102', '104']);
  });

  it('reconcilia duelos no resueltos con config WC actual', async () => {
    const { groupId } = await setupGroupWithHumans(8);
    await finishRoundOf32();
    const seeded = await trySeedFubolsCup(groupId);
    const semiRound = seeded.rounds.find((r) => r.roundKey === 'semi_final');
    semiRound.duels[0].worldCupExternalIds = ['101', '102'];
    semiRound.duels[1].worldCupExternalIds = ['103', '104'];
    await seeded.save();

    await processFubolsCupForGroup(groupId);
    const tournament = await FubolsCupTournament.findOne({ groupId });
    const semiAfter = tournament.rounds.find((r) => r.roundKey === 'semi_final');
    expect(semiAfter.duels[0].worldCupExternalIds).toHaveLength(2);
    expect(semiAfter.duels[1].worldCupExternalIds).toHaveLength(2);
    expect(sortExternalIds(semiAfter.duels.flatMap((d) => d.worldCupExternalIds))).toEqual([
      '97', '98', '99', '100',
    ]);
  });

  it('resuelve cruce 4-3 y 1-3 a favor de B', async () => {
    const { groupId, humans } = await setupGroupWithHumans(8);
    await finishRoundOf32();
    const seeded = await trySeedFubolsCup(groupId);
    const externalIds = seeded.rounds[0].duels[0].worldCupExternalIds;
    expect(externalIds).toHaveLength(2);

    const playerA = humans[0];
    const playerB = humans[7];

    for (const externalId of externalIds) {
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
      const pointsA = externalIds[0] === externalId ? 4 : 1;
      const pointsB = externalIds[0] === externalId ? 3 : 3;
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
      idempotencyKey: `fubols-cup-advance:${groupId}:quarter_final:quarter_final:0`,
    });
    expect(advanceTx?.amount).toBe(FUBOLS_CUP_ROUND_ADVANCE_PRIZE);
    const treasuryAfter =
      (await AppTreasury.findOne({ singletonKey: 'main' }))?.houseBalanceFubols ?? 0;
    expect(treasuryAfter).toBe(treasuryBefore - FUBOLS_CUP_ROUND_ADVANCE_PRIZE);
  });

  it('muestra banderas Ganador de según fase final oficial (no predicciones)', async () => {
    for (const team of [
      { externalId: 'POR', nameEn: 'Portugal', fifaCode: 'POR', group: 'F' },
      { externalId: 'CRO', nameEn: 'Croatia', fifaCode: 'CRO', group: 'F' },
      { externalId: 'ESP', nameEn: 'Spain', fifaCode: 'ESP', group: 'E' },
      { externalId: 'AUT', nameEn: 'Austria', fifaCode: 'AUT', group: 'E' },
    ]) {
      await Team.findOneAndUpdate({ externalId: team.externalId }, team, { upsert: true });
    }

    const r16 = await Match.findOneAndUpdate(
      { externalId: '89' },
      {
        externalId: '89',
        homeTeamId: 'POR',
        awayTeamId: 'CRO',
        homeScore: 0,
        awayScore: 0,
        type: 'round_of_16',
        status: 'upcoming',
        raw: { home_team_label: 'Winner Group F', away_team_label: 'Runner-up Group E' },
      },
      { upsert: true, new: true }
    );
    cleanup.matchIds.push(r16._id);

    const qf = await Match.findOneAndUpdate(
      { externalId: '97' },
      {
        externalId: '97',
        homeTeamId: '0',
        awayTeamId: '0',
        homeScore: 0,
        awayScore: 0,
        type: 'quarter_final',
        status: 'upcoming',
        kickoffAt: new Date('2026-07-09T20:00:00Z'),
        raw: { home_team_label: 'Winner Match 89', away_team_label: 'Winner Match 90' },
      },
      { upsert: true, new: true }
    );
    cleanup.matchIds.push(qf._id);

    const { groupId, admin } = await setupGroupWithHumans(8);
    const dashboard = await getFubolsCupDashboard(groupId, admin._id);

    const semiRound = dashboard.rounds.find((r) => r.roundKey === 'semi_final');
    const wc97 = semiRound.duels
      .flatMap((d) => d.worldCupMatches ?? [])
      .find((wc) => wc.externalId === '97');

    expect(wc97?.match?.homeTeamSlotSourceMatch?.homeTeam?.fifaCode).toBe('POR');
    expect(wc97?.match?.homeTeamSlotSourceMatch?.awayTeam?.fifaCode).toBe('CRO');
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
