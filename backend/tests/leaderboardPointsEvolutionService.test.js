import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { Match } from '../src/models/Match.js';
import { Prediction } from '../src/models/Prediction.js';
import { User } from '../src/models/User.js';
import { UserGroupMembership } from '../src/models/UserGroupMembership.js';
import { CompetitionGroup } from '../src/models/CompetitionGroup.js';
import { Team } from '../src/models/Team.js';
import { getLeaderboardPointsEvolution } from '../src/services/leaderboardPointsEvolutionService.js';
import { assignPlayerChartColors } from '../../shared/playerChartColors.js';
import { getTestMongoUri } from '../src/config/testDbGuard.js';

const mongoUri = getTestMongoUri();

describe('leaderboardPointsEvolutionService', () => {
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
      Team.deleteMany({}),
    ]);
  });

  it('calcula posiciones por checkpoint en orden cronológico', async () => {
    const group = await CompetitionGroup.create({ name: 'Evolución', inviteCode: 'EVOL01' });
    const [alice, bob] = await User.create([
      {
        name: 'Alice',
        email: 'alice@example.com',
        passwordHash: 'hash',
        competitionGroupId: group._id,
      },
      {
        name: 'Bob',
        email: 'bob@example.com',
        passwordHash: 'hash',
        competitionGroupId: group._id,
      },
    ]);
    await UserGroupMembership.create([
      { userId: alice._id, groupId: group._id, role: 'member' },
      { userId: bob._id, groupId: group._id, role: 'member' },
    ]);

    await Team.create([
      { externalId: 'arg', fifaCode: 'ARG', nameEn: 'Argentina' },
      { externalId: 'mex', fifaCode: 'MEX', nameEn: 'Mexico' },
      { externalId: 'bra', fifaCode: 'BRA', nameEn: 'Brazil' },
      { externalId: 'fra', fifaCode: 'FRA', nameEn: 'France' },
    ]);

    const [match1, match2] = await Match.create([
      {
        externalId: 'evo-1',
        homeTeamId: 'arg',
        awayTeamId: 'mex',
        homeScore: 2,
        awayScore: 1,
        status: 'finished',
        kickoffAt: new Date('2026-06-11T18:00:00.000Z'),
      },
      {
        externalId: 'evo-2',
        homeTeamId: 'bra',
        awayTeamId: 'fra',
        homeScore: 0,
        awayScore: 0,
        status: 'finished',
        kickoffAt: new Date('2026-06-12T18:00:00.000Z'),
      },
    ]);

    await Prediction.create([
      {
        userId: alice._id,
        matchId: match1._id,
        homeGoals: 2,
        awayGoals: 1,
        pointsEarned: 6,
        bonusPoint: 1,
        pointsBreakdown: { winner: 3, homeGoals: 1, awayGoals: 1, totalGoals: 1 },
      },
      {
        userId: alice._id,
        matchId: match2._id,
        homeGoals: 0,
        awayGoals: 0,
        pointsEarned: 3,
        bonusPoint: 0,
        pointsBreakdown: { winner: 3, homeGoals: 0, awayGoals: 0, totalGoals: 0 },
      },
      {
        userId: bob._id,
        matchId: match1._id,
        homeGoals: 1,
        awayGoals: 0,
        pointsEarned: 2,
        bonusPoint: 0,
        pointsBreakdown: { winner: 0, homeGoals: 1, awayGoals: 0, totalGoals: 0 },
      },
      {
        userId: bob._id,
        matchId: match2._id,
        homeGoals: 1,
        awayGoals: 1,
        pointsEarned: 4,
        bonusPoint: 0,
        pointsBreakdown: { winner: 3, homeGoals: 0, awayGoals: 0, totalGoals: 1 },
      },
    ]);

    const result = await getLeaderboardPointsEvolution(group._id.toString());

    expect(result.notFound).toBeUndefined();
    expect(result.checkpoints).toHaveLength(3);
    expect(result.checkpoints[0]).toMatchObject({ index: 0, label: 'Inicio', matchId: null });
    expect(result.checkpoints[1].label).toBe('ARG · MEX');
    expect(result.checkpoints[2].label).toBe('BRA · FRA');

    const aliceSeries = result.series.find((row) => row.userId === alice._id.toString());
    const bobSeries = result.series.find((row) => row.userId === bob._id.toString());

    expect(aliceSeries.ranks).toEqual([0, 1, 1]);
    expect(bobSeries.ranks).toEqual([0, 2, 2]);

    const colors = assignPlayerChartColors([alice._id.toString(), bob._id.toString()]);
    expect(aliceSeries.color).toBe(colors.get(alice._id.toString()));
    expect(bobSeries.color).toBe(colors.get(bob._id.toString()));
    expect(aliceSeries.color).not.toBe(bobSeries.color);
  });

  it('devuelve notFound para grupo inexistente', async () => {
    const result = await getLeaderboardPointsEvolution(new mongoose.Types.ObjectId().toString());
    expect(result).toEqual({ notFound: true });
  });
});
