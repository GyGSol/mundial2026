import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { Match } from '../src/models/Match.js';
import { Prediction } from '../src/models/Prediction.js';
import { User } from '../src/models/User.js';
import { backfillPredictionGoalDiffs } from '../src/services/predictionMigrationService.js';

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mundial2026_test';

describe('backfillPredictionGoalDiffs', () => {
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
    await Promise.all([Prediction.deleteMany({}), Match.deleteMany({}), User.deleteMany({})]);
  });

  it('carga dif local/visitante desde resultado finalizado vs predicción', async () => {
    const user = await User.create({
      name: 'Tester',
      email: 'goal-diff@example.com',
      passwordHash: 'hash',
      totalPoints: 3,
    });
    const match = await Match.create({
      externalId: 'goal-diff-1',
      homeTeamId: '1',
      awayTeamId: '2',
      homeScore: 2,
      awayScore: 0,
      status: 'finished',
      kickoffAt: new Date('2026-06-13T01:00:00.000Z'),
    });
    const prediction = await Prediction.create({
      userId: user._id,
      matchId: match._id,
      homeGoals: 1,
      awayGoals: 0,
      pointsEarned: 3,
      pointsBreakdown: { winner: 3, homeGoals: 0, awayGoals: 1, totalGoals: 0 },
    });

    const result = await backfillPredictionGoalDiffs({ onlyMissing: true });
    expect(result.updated).toBe(1);

    const updated = await Prediction.findById(prediction._id).lean();
    expect(updated.goalDiffHome).toBe(1);
    expect(updated.goalDiffAway).toBe(0);
  });

  it('no toca predicciones que ya tienen dif cargada si onlyMissing', async () => {
    const user = await User.create({
      name: 'Tester',
      email: 'goal-diff-2@example.com',
      passwordHash: 'hash',
      totalPoints: 6,
    });
    const match = await Match.create({
      externalId: 'goal-diff-2',
      homeTeamId: '1',
      awayTeamId: '2',
      homeScore: 1,
      awayScore: 0,
      status: 'finished',
      kickoffAt: new Date('2026-06-13T02:00:00.000Z'),
    });
    await Prediction.create({
      userId: user._id,
      matchId: match._id,
      homeGoals: 1,
      awayGoals: 0,
      pointsEarned: 6,
      goalDiffHome: 0,
      goalDiffAway: 0,
      pointsBreakdown: { winner: 3, homeGoals: 1, awayGoals: 1, totalGoals: 1 },
    });

    const result = await backfillPredictionGoalDiffs({ onlyMissing: true });
    expect(result.updated).toBe(0);
  });
});
