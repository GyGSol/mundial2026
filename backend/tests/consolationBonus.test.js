import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import {
  CONSOLATION_BONUS,
  CONSOLATION_REASON,
  CONSOLATION_STREAK,
  recalculateConsolationBonuses,
} from '../src/services/consolationBonusService.js';
import { rankMatchPredictions } from '../src/services/matchPredictionRankingsService.js';
import { Match } from '../src/models/Match.js';
import { Prediction } from '../src/models/Prediction.js';
import { User } from '../src/models/User.js';
import { getTestMongoUri } from '../src/config/testDbGuard.js';

const mongoUri = getTestMongoUri();

async function createFinishedZeroStreak(userId, prefix) {
  const kickoffs = [
    new Date('2026-06-11T18:00:00.000Z'),
    new Date('2026-06-12T18:00:00.000Z'),
    new Date('2026-06-13T18:00:00.000Z'),
  ];
  const predictions = [];

  for (let i = 0; i < 3; i += 1) {
    const match = await Match.create({
      externalId: `${prefix}-${i + 1}`,
      homeTeamId: '1',
      awayTeamId: '2',
      homeScore: 2,
      awayScore: 1,
      status: 'finished',
      kickoffAt: kickoffs[i],
    });
    const prediction = await Prediction.create({
      userId,
      matchId: match._id,
      homeGoals: 0,
      awayGoals: 0,
      pointsEarned: 0,
      pointsBreakdown: { winner: 0, homeGoals: 0, awayGoals: 0, totalGoals: 0 },
      bonusPoint: 1,
      bonusReason: CONSOLATION_REASON,
    });
    predictions.push(prediction);
  }

  return predictions;
}

describe('consolationBonusService constants', () => {
  it('define racha de 3 partidos y bonus de 1 punto', () => {
    expect(CONSOLATION_STREAK).toBe(3);
    expect(CONSOLATION_BONUS).toBe(1);
    expect(CONSOLATION_REASON).toContain('3 partidos');
  });
});

describe('match rankings with PB', () => {
  it('incluye bonus y motivo en el ranking del partido', () => {
    const userMap = { u1: 'Ana' };
    const ranked = rankMatchPredictions(
      [
        {
          userId: 'u1',
          pointsEarned: 0,
          bonusPoint: 1,
          bonusReason: CONSOLATION_REASON,
          pointsBreakdown: { winner: 0, homeGoals: 0, awayGoals: 0, totalGoals: 0 },
        },
      ],
      userMap
    );

    expect(ranked).toHaveLength(1);
    expect(ranked[0]).toMatchObject({
      points: 1,
      pb: 1,
      bonusReason: CONSOLATION_REASON,
    });
  });
});

describe('recalculateConsolationBonuses', () => {
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

  it('humano con 3 ceros consecutivos recibe +1 PB en el tercer partido', async () => {
    const user = await User.create({
      name: 'Humano',
      email: 'humano-pb@example.com',
      passwordHash: 'hash',
      isAiUser: false,
    });

    await createFinishedZeroStreak(user._id, 'pb-human');

    await recalculateConsolationBonuses(user._id);

    const predictions = await Prediction.find({ userId: user._id }).sort({ createdAt: 1 });
    const pbTotal = predictions.reduce((sum, row) => sum + (row.bonusPoint ?? 0), 0);
    expect(pbTotal).toBe(CONSOLATION_BONUS);
    expect(predictions[2].bonusPoint).toBe(CONSOLATION_BONUS);
    expect(predictions[2].bonusReason).toBe(CONSOLATION_REASON);
  });

  it('jugador IA con 3 ceros consecutivos queda siempre en 0 PB', async () => {
    const aiUser = await User.create({
      name: '@predictivemodeling',
      email: 'predictivemodeling@mundial2026.bot',
      passwordHash: 'hash',
      isAiUser: true,
    });

    await createFinishedZeroStreak(aiUser._id, 'pb-ai');

    await recalculateConsolationBonuses(aiUser._id);

    const predictions = await Prediction.find({ userId: aiUser._id });
    const pbTotal = predictions.reduce((sum, row) => sum + (row.bonusPoint ?? 0), 0);
    expect(pbTotal).toBe(0);
    expect(predictions.every((row) => !row.bonusReason)).toBe(true);
  });
});
