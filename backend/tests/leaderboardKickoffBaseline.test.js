import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { Match } from '../src/models/Match.js';
import { Prediction } from '../src/models/Prediction.js';
import { User } from '../src/models/User.js';
import { UserGroupMembership } from '../src/models/UserGroupMembership.js';
import { CompetitionGroup } from '../src/models/CompetitionGroup.js';
import { getLeaderboard } from '../src/services/leaderboardService.js';

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mundial2026_test';

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
});
