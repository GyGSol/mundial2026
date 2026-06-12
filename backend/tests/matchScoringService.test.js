import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { Match } from '../src/models/Match.js';
import { Prediction } from '../src/models/Prediction.js';
import { User } from '../src/models/User.js';
import {
  clearMatchScores,
  clearStaleUpcomingMatchScores,
  recalculateMatchScores,
} from '../src/services/matchScoringService.js';

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mundial2026_test';

describe('matchScoringService', () => {
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

  it('clearMatchScores elimina puntos cuando un partido vuelve a upcoming', async () => {
    const user = await User.create({
      name: 'Tester',
      email: 'tester@example.com',
      passwordHash: 'hash',
      totalPoints: 6,
    });
    const match = await Match.create({
      externalId: 'score-clear-1',
      homeTeamId: '1',
      awayTeamId: '2',
      homeScore: 0,
      awayScore: 0,
      status: 'upcoming',
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
    await User.findByIdAndUpdate(user._id, { totalPoints: 6 });

    const result = await clearMatchScores(match._id);

    expect(result.predictions).toBe(1);
    expect(result.users).toBe(1);

    const prediction = await Prediction.findOne({ matchId: match._id });
    expect(prediction.pointsEarned).toBeNull();
    expect(prediction.pointsBreakdown?.winner).toBeUndefined();

    const updatedUser = await User.findById(user._id);
    expect(updatedUser.totalPoints).toBe(0);
  });

  it('recalculateMatchScores no puntúa partidos upcoming', async () => {
    const user = await User.create({
      name: 'Tester 2',
      email: 'tester2@example.com',
      passwordHash: 'hash',
      totalPoints: 0,
    });
    const match = await Match.create({
      externalId: 'score-clear-2',
      homeTeamId: '1',
      awayTeamId: '2',
      homeScore: 0,
      awayScore: 0,
      status: 'upcoming',
      kickoffAt: new Date('2026-06-13T01:00:00.000Z'),
    });
    await Prediction.create({
      userId: user._id,
      matchId: match._id,
      homeGoals: 0,
      awayGoals: 0,
      pointsEarned: null,
    });

    const result = await recalculateMatchScores(match._id);
    expect(result.predictions).toBe(0);

    const prediction = await Prediction.findOne({ matchId: match._id });
    expect(prediction.pointsEarned).toBeNull();
  });

  it('clearStaleUpcomingMatchScores repara partidos upcoming con puntos colgados', async () => {
    const user = await User.create({
      name: 'Tester 3',
      email: 'tester3@example.com',
      passwordHash: 'hash',
      totalPoints: 3,
    });
    const match = await Match.create({
      externalId: 'score-clear-3',
      homeTeamId: '1',
      awayTeamId: '2',
      homeScore: 0,
      awayScore: 0,
      status: 'upcoming',
      kickoffAt: new Date('2026-06-13T01:00:00.000Z'),
    });
    await Prediction.create({
      userId: user._id,
      matchId: match._id,
      homeGoals: 1,
      awayGoals: 1,
      pointsEarned: 3,
      pointsBreakdown: { winner: 3, homeGoals: 0, awayGoals: 0, totalGoals: 0 },
    });
    await User.findByIdAndUpdate(user._id, { totalPoints: 3 });

    const result = await clearStaleUpcomingMatchScores();

    expect(result.clearedMatches).toBe(1);
    expect(result.clearedPredictions).toBe(1);

    const updatedUser = await User.findById(user._id);
    expect(updatedUser.totalPoints).toBe(0);
  });
});
