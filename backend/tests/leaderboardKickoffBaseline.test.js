import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { Match } from '../src/models/Match.js';
import { Prediction } from '../src/models/Prediction.js';
import { User } from '../src/models/User.js';
import { UserGroupMembership } from '../src/models/UserGroupMembership.js';
import { CompetitionGroup } from '../src/models/CompetitionGroup.js';
import { getLeaderboard, getLiveMatchStatIndicatorsByUser } from '../src/services/leaderboardService.js';
import { getTestMongoUri } from '../src/config/testDbGuard.js';

const mongoUri = getTestMongoUri();

describe('leaderboard kickoff baseline', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  beforeEach(async () => {
    await Promise.all([
      Prediction.deleteMany({}),
      Match.deleteMany({}),
      User.deleteMany({}),
      UserGroupMembership.deleteMany({}),
      CompetitionGroup.deleteMany({}),
    ]);
  });

  it('calcula baseline 0-0 aunque no exista snapshot guardado', async () => {
    const group = await CompetitionGroup.create({ name: 'Test', inviteCode: 'TEST01' });
    const user = await User.create({
      name: 'Entrada tardía',
      email: 'tardia@example.com',
      passwordHash: 'hash',
      totalPoints: 6,
      competitionGroupId: group._id,
    });
    await UserGroupMembership.create({ userId: user._id, groupId: group._id, role: 'member' });

    const match = await Match.create({
      externalId: 'live-no-snapshot',
      homeTeamId: '1',
      awayTeamId: '2',
      homeScore: 1,
      awayScore: 0,
      status: 'live',
      liveScoringInitialized: true,
      kickoffAt: new Date('2026-06-13T01:00:00.000Z'),
    });

    await Prediction.create({
      userId: user._id,
      matchId: match._id,
      homeGoals: 1,
      awayGoals: 0,
      pointsEarned: 6,
      pointsBreakdown: { winner: 3, homeGoals: 1, awayGoals: 1, totalGoals: 1 },
    });

    const [current, baseline] = await Promise.all([
      getLeaderboard(group._id.toString()),
      getLeaderboard(group._id.toString(), 100, { liveKickoffBaselineMatchIds: [match._id.toString()] }),
    ]);

    const currentRow = current.find((row) => row.id === user._id.toString());
    const baselineRow = baseline.find((row) => row.id === user._id.toString());

    expect(currentRow.pa).toBe(1);
    expect(currentRow.gl).toBe(1);
    expect(baselineRow.pa).toBe(0);
    expect(baselineRow.gl).toBe(0);
    expect(baselineRow.totalPoints).toBeLessThan(currentRow.totalPoints);
  });

  it('calcula baseline 0-0 para partido ya finalizado (flechas al terminar)', async () => {
    const group = await CompetitionGroup.create({ name: 'Test', inviteCode: 'TEST02' });
    const user = await User.create({
      name: 'Post partido',
      email: 'post@example.com',
      passwordHash: 'hash',
      totalPoints: 6,
      competitionGroupId: group._id,
    });
    await UserGroupMembership.create({ userId: user._id, groupId: group._id, role: 'member' });

    const match = await Match.create({
      externalId: 'finished-baseline',
      homeTeamId: '1',
      awayTeamId: '2',
      homeScore: 2,
      awayScore: 1,
      status: 'finished',
      liveScoringInitialized: true,
      kickoffAt: new Date('2026-06-13T01:00:00.000Z'),
    });

    await Prediction.create({
      userId: user._id,
      matchId: match._id,
      homeGoals: 2,
      awayGoals: 1,
      pointsEarned: 6,
      pointsBreakdown: { winner: 3, homeGoals: 1, awayGoals: 1, totalGoals: 1 },
    });

    const [current, baseline] = await Promise.all([
      getLeaderboard(group._id.toString()),
      getLeaderboard(group._id.toString(), 100, {
        liveKickoffBaselineMatchIds: [match._id.toString()],
      }),
    ]);

    const currentRow = current.find((row) => row.id === user._id.toString());
    const baselineRow = baseline.find((row) => row.id === user._id.toString());

    expect(currentRow.totalPoints).toBe(6);
    expect(baselineRow.totalPoints).toBeLessThan(currentRow.totalPoints);
  });

  it('baseline excluyendo partido en vivo difiere del ranking actual con live scoring', async () => {
    const group = await CompetitionGroup.create({ name: 'Test', inviteCode: 'TEST03' });
    const user = await User.create({
      name: 'En vivo',
      email: 'vivo@example.com',
      passwordHash: 'hash',
      totalPoints: 6,
      competitionGroupId: group._id,
    });
    await UserGroupMembership.create({ userId: user._id, groupId: group._id, role: 'member' });

    const match = await Match.create({
      externalId: 'live-exclude',
      homeTeamId: '1',
      awayTeamId: '2',
      homeScore: 0,
      awayScore: 0,
      status: 'live',
      liveScoringInitialized: true,
      kickoffAt: new Date('2026-06-13T01:00:00.000Z'),
    });

    await Prediction.create({
      userId: user._id,
      matchId: match._id,
      homeGoals: 0,
      awayGoals: 0,
      pointsEarned: 6,
      pointsBreakdown: { winner: 3, homeGoals: 1, awayGoals: 1, totalGoals: 1 },
    });

    const [current, excluded] = await Promise.all([
      getLeaderboard(group._id.toString()),
      getLeaderboard(group._id.toString(), 100, { excludeMatchIds: [match._id.toString()] }),
    ]);

    const currentRow = current.find((row) => row.id === user._id.toString());
    const excludedRow = excluded.find((row) => row.id === user._id.toString());

    expect(currentRow.pa).toBe(1);
    expect(excludedRow.pa).toBe(0);
    expect(currentRow.totalPoints).toBeGreaterThan(excludedRow.totalPoints);
  });

  it('partido finalizado no genera delta de stats si solo se excluyen en vivo', async () => {
    const group = await CompetitionGroup.create({ name: 'Test', inviteCode: 'TEST04' });
    const user = await User.create({
      name: 'Gisela caso',
      email: 'gisela@example.com',
      passwordHash: 'hash',
      totalPoints: 4,
      competitionGroupId: group._id,
    });
    await UserGroupMembership.create({ userId: user._id, groupId: group._id, role: 'member' });

    const finished = await Match.create({
      externalId: 'finished-pa',
      homeTeamId: '1',
      awayTeamId: '2',
      homeScore: 3,
      awayScore: 1,
      status: 'finished',
      kickoffAt: new Date('2026-06-16T19:00:00.000Z'),
    });
    const live = await Match.create({
      externalId: 'live-gl-only',
      homeTeamId: '3',
      awayTeamId: '4',
      homeScore: 0,
      awayScore: 0,
      status: 'live',
      liveScoringInitialized: true,
      kickoffAt: new Date('2026-06-16T22:00:00.000Z'),
    });

    await Prediction.create({
      userId: user._id,
      matchId: finished._id,
      homeGoals: 2,
      awayGoals: 0,
      pointsEarned: 3,
      pointsBreakdown: { winner: 3, homeGoals: 0, awayGoals: 0, totalGoals: 0 },
    });
    await Prediction.create({
      userId: user._id,
      matchId: live._id,
      homeGoals: 0,
      awayGoals: 2,
      pointsEarned: 1,
      pointsBreakdown: { winner: 0, homeGoals: 1, awayGoals: 0, totalGoals: 0 },
    });

    const [current, baseline] = await Promise.all([
      getLeaderboard(group._id.toString()),
      getLeaderboard(group._id.toString(), 100, { excludeMatchIds: [live._id.toString()] }),
    ]);

    const currentRow = current.find((row) => row.id === user._id.toString());
    const baselineRow = baseline.find((row) => row.id === user._id.toString());

    expect(currentRow.pa).toBe(1);
    expect(baselineRow.pa).toBe(1);
    expect(currentRow.gl).toBe(1);
    expect(baselineRow.gl).toBe(0);
    expect(currentRow.gv).toBe(0);
    expect(baselineRow.gv).toBe(0);
  });

  it('varios partidos en vivo excluidos acumulan delta de stats', async () => {
    const group = await CompetitionGroup.create({ name: 'Test', inviteCode: 'TEST05' });
    const user = await User.create({
      name: 'Multi live',
      email: 'multi@example.com',
      passwordHash: 'hash',
      totalPoints: 10,
      competitionGroupId: group._id,
    });
    await UserGroupMembership.create({ userId: user._id, groupId: group._id, role: 'member' });

    const liveA = await Match.create({
      externalId: 'live-a',
      homeTeamId: '1',
      awayTeamId: '2',
      homeScore: 0,
      awayScore: 0,
      status: 'live',
      liveScoringInitialized: true,
      kickoffAt: new Date('2026-06-16T19:00:00.000Z'),
    });
    const liveB = await Match.create({
      externalId: 'live-b',
      homeTeamId: '3',
      awayTeamId: '4',
      homeScore: 1,
      awayScore: 0,
      status: 'live',
      liveScoringInitialized: true,
      kickoffAt: new Date('2026-06-16T19:05:00.000Z'),
    });
    const liveC = await Match.create({
      externalId: 'live-c',
      homeTeamId: '5',
      awayTeamId: '6',
      homeScore: 0,
      awayScore: 1,
      status: 'live',
      liveScoringInitialized: true,
      kickoffAt: new Date('2026-06-16T19:10:00.000Z'),
    });

    await Prediction.create({
      userId: user._id,
      matchId: liveA._id,
      homeGoals: 0,
      awayGoals: 0,
      pointsEarned: 6,
      pointsBreakdown: { winner: 3, homeGoals: 1, awayGoals: 1, totalGoals: 1 },
    });
    await Prediction.create({
      userId: user._id,
      matchId: liveB._id,
      homeGoals: 1,
      awayGoals: 0,
      pointsEarned: 6,
      pointsBreakdown: { winner: 3, homeGoals: 1, awayGoals: 1, totalGoals: 1 },
    });
    await Prediction.create({
      userId: user._id,
      matchId: liveC._id,
      homeGoals: 0,
      awayGoals: 2,
      pointsEarned: 4,
      pointsBreakdown: { winner: 3, homeGoals: 1, awayGoals: 0, totalGoals: 0 },
    });

    const liveIds = [liveA, liveB, liveC].map((m) => m._id.toString());
    const [current, baseline] = await Promise.all([
      getLeaderboard(group._id.toString()),
      getLeaderboard(group._id.toString(), 100, { excludeMatchIds: liveIds }),
    ]);

    const currentRow = current.find((row) => row.id === user._id.toString());
    const baselineRow = baseline.find((row) => row.id === user._id.toString());

    expect(currentRow.pa).toBe(3);
    expect(baselineRow.pa).toBe(0);
    expect(currentRow.gl).toBe(3);
    expect(baselineRow.gl).toBe(0);
    expect(currentRow.gv).toBe(2);
    expect(baselineRow.gv).toBe(0);
    expect(currentRow.gt).toBe(2);
    expect(baselineRow.gt).toBe(0);
  });

  it('genera una flecha por partido en vivo que aporta a cada stat', async () => {
    const group = await CompetitionGroup.create({ name: 'Test', inviteCode: 'TEST08' });
    const user = await User.create({
      name: 'Multi live',
      email: 'multi@example.com',
      passwordHash: 'hash',
      totalPoints: 16,
      competitionGroupId: group._id,
    });
    await UserGroupMembership.create({ userId: user._id, groupId: group._id, role: 'member' });

    const liveA = await Match.create({
      externalId: 'live-ind-a',
      homeTeamId: '1',
      awayTeamId: '2',
      homeScore: 0,
      awayScore: 0,
      status: 'live',
      liveScoringInitialized: true,
      kickoffAt: new Date('2026-06-16T19:00:00.000Z'),
    });
    const liveB = await Match.create({
      externalId: 'live-ind-b',
      homeTeamId: '3',
      awayTeamId: '4',
      homeScore: 1,
      awayScore: 0,
      status: 'live',
      liveScoringInitialized: true,
      kickoffAt: new Date('2026-06-16T19:05:00.000Z'),
    });

    await Prediction.create({
      userId: user._id,
      matchId: liveA._id,
      homeGoals: 0,
      awayGoals: 0,
      pointsEarned: 3,
      pointsBreakdown: { winner: 3, homeGoals: 0, awayGoals: 0, totalGoals: 0 },
    });
    await Prediction.create({
      userId: user._id,
      matchId: liveB._id,
      homeGoals: 1,
      awayGoals: 0,
      pointsEarned: 4,
      pointsBreakdown: { winner: 3, homeGoals: 1, awayGoals: 0, totalGoals: 0 },
    });

    const liveIds = [liveA._id.toString(), liveB._id.toString()];
    const indicators = await getLiveMatchStatIndicatorsByUser([user._id.toString()], liveIds);
    const row = indicators.byUser[user._id.toString()];

    expect(indicators.liveMatchIds).toEqual(liveIds);
    expect(row.pa).toEqual([false, true]);
    expect(row.gl).toEqual([false, true]);
    expect(row.gv).toEqual([false, false]);
    expect(row.gt).toEqual([false, false]);
  });

  it('con 0-1 en vivo las flechas GL/GV/GT no se pre-creditan al kickoff 0-0', async () => {
    const group = await CompetitionGroup.create({ name: 'Test', inviteCode: 'TEST07' });
    const exact = await User.create({
      name: 'Gisela',
      email: 'gisela01@example.com',
      passwordHash: 'hash',
      totalPoints: 10,
      competitionGroupId: group._id,
    });
    const awayWin = await User.create({
      name: 'Gonzalo',
      email: 'gonzalo01@example.com',
      passwordHash: 'hash',
      totalPoints: 8,
      competitionGroupId: group._id,
    });
    await UserGroupMembership.create({ userId: exact._id, groupId: group._id, role: 'member' });
    await UserGroupMembership.create({ userId: awayWin._id, groupId: group._id, role: 'member' });

    const live = await Match.create({
      externalId: 'live-01',
      homeTeamId: 'uzb',
      awayTeamId: 'col',
      homeScore: 0,
      awayScore: 1,
      status: 'live',
      liveScoringInitialized: true,
      kickoffAt: new Date('2026-06-17T01:00:00.000Z'),
    });

    await Prediction.create({
      userId: exact._id,
      matchId: live._id,
      homeGoals: 0,
      awayGoals: 1,
      pointsEarned: 5,
      pointsBreakdown: { winner: 3, homeGoals: 1, awayGoals: 1, totalGoals: 1 },
      liveKickoffBreakdown: { winner: 0, homeGoals: 1, awayGoals: 0, totalGoals: 0 },
      liveKickoffPointsEarned: 1,
    });
    await Prediction.create({
      userId: awayWin._id,
      matchId: live._id,
      homeGoals: 0,
      awayGoals: 2,
      pointsEarned: 4,
      pointsBreakdown: { winner: 3, homeGoals: 1, awayGoals: 0, totalGoals: 0 },
      liveKickoffBreakdown: { winner: 0, homeGoals: 1, awayGoals: 0, totalGoals: 0 },
      liveKickoffPointsEarned: 1,
    });

    const [current, baseline] = await Promise.all([
      getLeaderboard(group._id.toString()),
      getLeaderboard(group._id.toString(), 100, {
        liveKickoffBaselineMatchIds: [live._id.toString()],
      }),
    ]);

    const exactCurrent = current.find((row) => row.id === exact._id.toString());
    const exactBaseline = baseline.find((row) => row.id === exact._id.toString());
    const awayCurrent = current.find((row) => row.id === awayWin._id.toString());
    const awayBaseline = baseline.find((row) => row.id === awayWin._id.toString());

    expect(exactCurrent.gl).toBe(1);
    expect(exactBaseline.gl).toBe(0);
    expect(exactCurrent.gv).toBe(1);
    expect(exactBaseline.gv).toBe(0);
    expect(exactCurrent.gt).toBe(1);
    expect(exactBaseline.gt).toBe(0);

    expect(awayCurrent.gl).toBe(1);
    expect(awayBaseline.gl).toBe(0);
    expect(awayCurrent.gv).toBe(0);
    expect(awayBaseline.gv).toBe(0);
  });

  it('marca flecha GV al acertar visitante en 0-1 sin pre-creditarla al kickoff', async () => {
    const group = await CompetitionGroup.create({ name: 'Test', inviteCode: 'TEST09' });
    const exact = await User.create({
      name: 'Exacta visitante',
      email: 'exact-gv@example.com',
      passwordHash: 'hash',
      totalPoints: 10,
      competitionGroupId: group._id,
    });
    await UserGroupMembership.create({ userId: exact._id, groupId: group._id, role: 'member' });

    const live = await Match.create({
      externalId: 'live-gv-ind',
      homeTeamId: '1',
      awayTeamId: '2',
      homeScore: 0,
      awayScore: 1,
      status: 'live',
      liveScoringInitialized: true,
      kickoffAt: new Date('2026-06-17T02:00:00.000Z'),
    });

    await Prediction.create({
      userId: exact._id,
      matchId: live._id,
      homeGoals: 0,
      awayGoals: 1,
      pointsEarned: 5,
      pointsBreakdown: { winner: 3, homeGoals: 1, awayGoals: 1, totalGoals: 1 },
      liveKickoffBreakdown: { winner: 0, homeGoals: 1, awayGoals: 0, totalGoals: 0 },
      liveKickoffPointsEarned: 1,
    });

    const indicators = await getLiveMatchStatIndicatorsByUser(
      [exact._id.toString()],
      [live._id.toString()]
    );
    const row = indicators.byUser[exact._id.toString()];

    expect(row.gv).toEqual([true]);
    expect(row.gl).toEqual([true]);
    expect(row.pa).toEqual([true]);
    expect(row.gt).toEqual([true]);
  });

  it('no marca flecha GV en 1-0 si visitante=0 ya estaba acertado al kickoff 0-0', async () => {
    const group = await CompetitionGroup.create({ name: 'Test', inviteCode: 'TEST10' });
    const homeWin = await User.create({
      name: 'Local exacto',
      email: 'home-gv@example.com',
      passwordHash: 'hash',
      totalPoints: 10,
      competitionGroupId: group._id,
    });
    await UserGroupMembership.create({ userId: homeWin._id, groupId: group._id, role: 'member' });

    const live = await Match.create({
      externalId: 'live-gv-no-false',
      homeTeamId: '1',
      awayTeamId: '2',
      homeScore: 1,
      awayScore: 0,
      status: 'live',
      liveScoringInitialized: true,
      kickoffAt: new Date('2026-06-17T03:00:00.000Z'),
    });

    await Prediction.create({
      userId: homeWin._id,
      matchId: live._id,
      homeGoals: 1,
      awayGoals: 0,
      pointsEarned: 4,
      pointsBreakdown: { winner: 3, homeGoals: 1, awayGoals: 1, totalGoals: 0 },
      liveKickoffBreakdown: { winner: 0, homeGoals: 0, awayGoals: 1, totalGoals: 0 },
      liveKickoffPointsEarned: 1,
    });

    const indicators = await getLiveMatchStatIndicatorsByUser(
      [homeWin._id.toString()],
      [live._id.toString()]
    );
    const row = indicators.byUser[homeWin._id.toString()];

    expect(row.gl).toEqual([true]);
    expect(row.gv).toEqual([false]);
    expect(row.pa).toEqual([true]);
  });

  it('marca flecha GL en 0-1 exacto aunque local=0 ya coincidía al kickoff 0-0', async () => {
    const group = await CompetitionGroup.create({ name: 'Test', inviteCode: 'TEST11' });
    const exact = await User.create({
      name: 'Gisela',
      email: 'gisela-gl@example.com',
      passwordHash: 'hash',
      totalPoints: 10,
      competitionGroupId: group._id,
    });
    await UserGroupMembership.create({ userId: exact._id, groupId: group._id, role: 'member' });

    const live = await Match.create({
      externalId: 'live-gl-ind',
      homeTeamId: 'pan',
      awayTeamId: 'cro',
      homeScore: 0,
      awayScore: 1,
      status: 'live',
      liveScoringInitialized: true,
      kickoffAt: new Date('2026-06-24T01:00:00.000Z'),
    });

    await Prediction.create({
      userId: exact._id,
      matchId: live._id,
      homeGoals: 0,
      awayGoals: 1,
      pointsEarned: 6,
      pointsBreakdown: { winner: 3, homeGoals: 1, awayGoals: 1, totalGoals: 1 },
      liveKickoffBreakdown: { winner: 0, homeGoals: 1, awayGoals: 0, totalGoals: 0 },
      liveKickoffPointsEarned: 1,
    });

    const indicators = await getLiveMatchStatIndicatorsByUser(
      [exact._id.toString()],
      [live._id.toString()]
    );
    const row = indicators.byUser[exact._id.toString()];

    expect(row.gl).toEqual([true]);
    expect(row.gv).toEqual([true]);
    expect(row.pa).toEqual([true]);
  });

  it('dos partidos en vivo simultáneos acumulan flechas por stat (orden estable)', async () => {
    const group = await CompetitionGroup.create({ name: 'Test', inviteCode: 'TEST12' });
    const user = await User.create({
      name: 'Doble slot',
      email: 'doble-slot@example.com',
      passwordHash: 'hash',
      totalPoints: 20,
      competitionGroupId: group._id,
    });
    await UserGroupMembership.create({ userId: user._id, groupId: group._id, role: 'member' });

    const kickoffAt = new Date('2026-06-24T19:00:00.000Z');

    const liveA = await Match.create({
      externalId: 'simul-a',
      homeTeamId: 'pan',
      awayTeamId: 'cro',
      homeScore: 0,
      awayScore: 1,
      status: 'live',
      liveScoringInitialized: true,
      kickoffAt,
    });
    const liveB = await Match.create({
      externalId: 'simul-b',
      homeTeamId: 'eng',
      awayTeamId: 'fra',
      homeScore: 1,
      awayScore: 0,
      status: 'live',
      liveScoringInitialized: true,
      kickoffAt,
    });

    await Prediction.create({
      userId: user._id,
      matchId: liveA._id,
      homeGoals: 0,
      awayGoals: 1,
      pointsEarned: 6,
      pointsBreakdown: { winner: 3, homeGoals: 1, awayGoals: 1, totalGoals: 1 },
      liveKickoffBreakdown: { winner: 0, homeGoals: 1, awayGoals: 0, totalGoals: 0 },
      liveKickoffPointsEarned: 1,
    });
    await Prediction.create({
      userId: user._id,
      matchId: liveB._id,
      homeGoals: 1,
      awayGoals: 0,
      pointsEarned: 5,
      pointsBreakdown: { winner: 3, homeGoals: 1, awayGoals: 1, totalGoals: 1 },
      liveKickoffBreakdown: { winner: 0, homeGoals: 0, awayGoals: 1, totalGoals: 0 },
      liveKickoffPointsEarned: 1,
    });

    const liveIds = [liveA._id.toString(), liveB._id.toString()];
    const indicators = await getLiveMatchStatIndicatorsByUser([user._id.toString()], liveIds);
    const row = indicators.byUser[user._id.toString()];

    expect(indicators.liveMatchIds).toEqual(liveIds);
    expect(row.pa).toEqual([true, true]);
    expect(row.gl).toEqual([true, true]);
    expect(row.gv).toEqual([true, false]);
    expect(row.gt).toEqual([true, true]);

    const [current, baseline] = await Promise.all([
      getLeaderboard(group._id.toString()),
      getLeaderboard(group._id.toString(), 100, { liveKickoffBaselineMatchIds: liveIds }),
    ]);
    const currentRow = current.find((r) => r.id === user._id.toString());
    const baselineRow = baseline.find((r) => r.id === user._id.toString());
    expect(currentRow.pa - baselineRow.pa).toBe(2);
    expect(currentRow.gl - baselineRow.gl).toBe(2);
    expect(currentRow.gv - baselineRow.gv).toBe(1);
    expect(currentRow.gt - baselineRow.gt).toBe(2);
  });

  it('ranking actual usa puntos agregados de predicciones, no user.totalPoints desactualizado', async () => {
    const group = await CompetitionGroup.create({ name: 'Test', inviteCode: 'TEST06' });
    const user = await User.create({
      name: 'Pts stale',
      email: 'stale@example.com',
      passwordHash: 'hash',
      totalPoints: 99,
      competitionGroupId: group._id,
    });
    await UserGroupMembership.create({ userId: user._id, groupId: group._id, role: 'member' });

    const finished = await Match.create({
      externalId: 'finished-only',
      homeTeamId: '1',
      awayTeamId: '2',
      homeScore: 1,
      awayScore: 0,
      status: 'finished',
      kickoffAt: new Date('2026-06-10T19:00:00.000Z'),
    });

    await Prediction.create({
      userId: user._id,
      matchId: finished._id,
      homeGoals: 1,
      awayGoals: 0,
      pointsEarned: 6,
      pointsBreakdown: { winner: 3, homeGoals: 1, awayGoals: 1, totalGoals: 1 },
    });

    const [current, baseline] = await Promise.all([
      getLeaderboard(group._id.toString()),
      getLeaderboard(group._id.toString(), 100, { liveKickoffBaselineMatchIds: [finished._id.toString()] }),
    ]);

    const currentRow = current.find((row) => row.id === user._id.toString());
    const baselineRow = baseline.find((row) => row.id === user._id.toString());

    expect(currentRow.totalPoints).toBe(6);
    expect(currentRow.totalPoints).not.toBe(99);
    expect(baselineRow.totalPoints).toBeLessThan(currentRow.totalPoints);
    expect(currentRow.rank).toBe(baselineRow.rank);
  });
});
