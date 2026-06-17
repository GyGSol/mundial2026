import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import mongoose from 'mongoose';
import { User } from '../src/models/User.js';
import { Prediction } from '../src/models/Prediction.js';
import { PrizePool } from '../src/models/PrizePool.js';
import { FubolTransaction } from '../src/models/FubolTransaction.js';
import { AppTreasury } from '../src/models/AppTreasury.js';
import { CompetitionGroup } from '../src/models/CompetitionGroup.js';
import {
  creditUser,
  debitUser,
  chargeGroupEntryFee,
  computeMaxWithdrawal,
  grantWelcomeBonus,
  chargeAiConsultationFee,
  grantAiPlayBonus,
  getLiquidFubols,
  getTotalUserBalances,
} from '../src/services/fubolService.js';
import { GROUP_ENTRY_FEE, WELCOME_BONUS_FUBOLS, AI_PLAY_BONUS_FUBOLS, AI_CONSULTATION_FEE, AI_QUESTIONS_PER_FEE } from '../src/config/economy.js';

describe('fubolService', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(
        process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mundial2026-test'
      );
    }
  });

  afterAll(async () => {
    // keep connection for other suites
  });

  describe('credit and debit', () => {
    let userId;

    afterEach(async () => {
      if (userId) {
        await FubolTransaction.deleteMany({ userId });
        await User.deleteOne({ _id: userId });
        userId = null;
      }
    });

    beforeEach(async () => {
      const user = await User.create({
        name: 'Fubol Tester',
        email: `fubol-${Date.now()}-${Math.random()}@test.local`,
        passwordHash: 'hash',
        totalPoints: 42,
      });
      userId = user._id;
    });

    it('acredita y debita balance', async () => {
      await creditUser({
        userId,
        amount: 200,
        type: 'deposit',
        idempotencyKey: `test-deposit-${userId}`,
        skipTreasuryDeposit: true,
      });

      const afterCredit = await User.findById(userId).lean();
      expect(afterCredit.balanceFubols).toBe(200);
      expect(afterCredit.totalPoints).toBe(42);

      await debitUser({
        userId,
        amount: 50,
        type: 'entry_fee',
        idempotencyKey: `test-debit-${userId}`,
      });

      const afterDebit = await User.findById(userId).lean();
      expect(afterDebit.balanceFubols).toBe(150);
      expect(afterDebit.totalPoints).toBe(42);
    });

    it('rechaza débito con saldo insuficiente', async () => {
      await expect(
        debitUser({ userId, amount: 10, type: 'entry_fee' })
      ).rejects.toMatchObject({ status: 402 });
    });

    it('idempotencia evita doble crédito', async () => {
      const key = `idem-${userId}`;
      await creditUser({
        userId,
        amount: 100,
        type: 'welcome_bonus',
        idempotencyKey: key,
        skipTreasuryDeposit: true,
      });
      const second = await creditUser({
        userId,
        amount: 100,
        type: 'welcome_bonus',
        idempotencyKey: key,
        skipTreasuryDeposit: true,
      });
      expect(second.duplicate).toBe(true);
      const user = await User.findById(userId).lean();
      expect(user.balanceFubols).toBe(100);
    });
  });

  describe('group entry fee', () => {
    let userId;
    let aiUserId;
    let groupId;

    beforeEach(async () => {
      const group = await CompetitionGroup.create({
        name: `Fubol Group ${Date.now()}-${Math.random()}`,
      });
      groupId = group._id;

      const user = await User.create({
        name: 'Payer',
        email: `payer-${Date.now()}@test.local`,
        passwordHash: 'hash',
        balanceFubols: GROUP_ENTRY_FEE,
      });
      userId = user._id;

      const ai = await User.create({
        name: 'IA Bank',
        email: `ai-${Date.now()}@test.local`,
        passwordHash: 'hash',
        isAiUser: true,
        balanceFubols: 0,
      });
      aiUserId = ai._id;
    });

    afterEach(async () => {
      await PrizePool.deleteMany({ groupId });
      await FubolTransaction.deleteMany({ userId, groupId });
      await FubolTransaction.deleteMany({ userId: aiUserId, groupId });
      await User.deleteMany({ _id: { $in: [userId, aiUserId] } });
      await CompetitionGroup.deleteOne({ _id: groupId });
    });

    it('cobra inscripción y acumula pozo', async () => {
      const result = await chargeGroupEntryFee({ userId, groupId });
      expect(result.charged).toBe(true);

      const user = await User.findById(userId).lean();
      expect(user.balanceFubols).toBe(0);

      const pool = await PrizePool.findOne({ groupId }).lean();
      expect(pool.totalFubols).toBe(GROUP_ENTRY_FEE);
    });

    it('exenta usuario IA', async () => {
      const result = await chargeGroupEntryFee({ userId: aiUserId, groupId });
      expect(result.charged).toBe(false);
      expect(result.reason).toBe('ai_exempt');
    });
  });

  describe('ai consultation fee', () => {
    let userId;
    let aiUserId;

    beforeEach(async () => {
      const user = await User.create({
        name: 'AI Payer',
        email: `ai-payer-${Date.now()}@test.local`,
        passwordHash: 'hash',
        balanceFubols: AI_CONSULTATION_FEE,
      });
      userId = user._id;

      const ai = await User.create({
        name: 'IA Bank',
        email: `ai-consult-${Date.now()}@test.local`,
        passwordHash: 'hash',
        isAiUser: true,
        balanceFubols: 0,
      });
      aiUserId = ai._id;
    });

    afterEach(async () => {
      await FubolTransaction.deleteMany({ userId: { $in: [userId, aiUserId] } });
      await User.deleteMany({ _id: { $in: [userId, aiUserId] } });
    });

    it('cobra pack de consultas IA y descuenta créditos', async () => {
      const beforeTreasury = await AppTreasury.findOne({ singletonKey: 'main' }).lean();
      const houseBefore = beforeTreasury?.houseBalanceFubols ?? 0;

      const first = await chargeAiConsultationFee({ userId });
      expect(first.chargedPack).toBe(true);
      expect(first.fee).toBe(AI_CONSULTATION_FEE);
      expect(first.creditsRemaining).toBe(AI_QUESTIONS_PER_FEE - 1);

      const userAfterFirst = await User.findById(userId).lean();
      expect(userAfterFirst.balanceFubols).toBe(0);
      expect(userAfterFirst.aiQuestionCredits).toBe(AI_QUESTIONS_PER_FEE - 1);

      const second = await chargeAiConsultationFee({ userId });
      expect(second.chargedPack).toBe(false);
      expect(second.creditsRemaining).toBe(AI_QUESTIONS_PER_FEE - 2);

      const third = await chargeAiConsultationFee({ userId });
      expect(third.chargedPack).toBe(false);
      expect(third.creditsRemaining).toBe(0);

      const treasury = await AppTreasury.findOne({ singletonKey: 'main' }).lean();
      expect(treasury.houseBalanceFubols).toBe(houseBefore + AI_CONSULTATION_FEE);
    });

    it('rechaza consulta IA sin saldo para nuevo pack', async () => {
      await User.updateOne({ _id: userId }, { $set: { balanceFubols: 0, aiQuestionCredits: 0 } });
      await expect(chargeAiConsultationFee({ userId })).rejects.toMatchObject({ status: 402 });
    });

    it('exenta usuario IA en consultas', async () => {
      const result = await chargeAiConsultationFee({ userId: aiUserId });
      expect(result.charged).toBe(false);
      expect(result.reason).toBe('ai_exempt');
    });

    it('bono IA acredita 10 Fubols idempotente', async () => {
      await grantAiPlayBonus(userId);
      const second = await grantAiPlayBonus(userId);
      expect(second.duplicate).toBe(true);

      const user = await User.findById(userId).lean();
      expect(user.balanceFubols).toBe(AI_CONSULTATION_FEE + AI_PLAY_BONUS_FUBOLS);
    });
  });

  describe('withdrawal limit', () => {
    it('calcula tope proporcional a liquidez', async () => {
      await AppTreasury.findOneAndUpdate(
        { singletonKey: 'main' },
        {
          $set: {
            totalDepositedFubols: 1000,
            totalWithdrawnFubols: 200,
            houseBalanceFubols: 100,
          },
        },
        { upsert: true }
      );

      const user = await User.create({
        name: 'Withdraw',
        email: `withdraw-${Date.now()}@test.local`,
        passwordHash: 'hash',
        balanceFubols: 500,
      });

      const max = await computeMaxWithdrawal(user._id);
      const [liquid, totalBalances] = await Promise.all([
        getLiquidFubols(),
        getTotalUserBalances(),
      ]);
      expect(max).toBe(Math.floor(500 * (liquid / totalBalances)));

      await User.deleteOne({ _id: user._id });
    });
  });
});

describe('fubolIsolation', () => {
  let userId;
  let groupId;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(
        process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mundial2026-test'
      );
    }

    const group = await CompetitionGroup.create({
      name: `Isolation ${Date.now()}`,
    });
    groupId = group._id;

    const user = await User.create({
      name: 'Isolation User',
      email: `iso-${Date.now()}@test.local`,
      passwordHash: 'hash',
      totalPoints: 99,
      balanceFubols: GROUP_ENTRY_FEE + WELCOME_BONUS_FUBOLS,
    });
    userId = user._id;

    await Prediction.create({
      userId,
      matchId: new mongoose.Types.ObjectId(),
      homeGoals: 1,
      awayGoals: 0,
      pointsEarned: 3,
      pointsBreakdown: { winner: 3, homeGoals: 0, awayGoals: 0, totalGoals: 0 },
    });
  });

  afterAll(async () => {
    await Prediction.deleteMany({ userId });
    await FubolTransaction.deleteMany({ userId });
    await PrizePool.deleteMany({ groupId });
    await User.deleteOne({ _id: userId });
    await CompetitionGroup.deleteOne({ _id: groupId });
  });

  it('welcome bonus no altera totalPoints ni predicciones', async () => {
    const beforeUser = await User.findById(userId).lean();
    const beforePredCount = await Prediction.countDocuments({ userId });

    await grantWelcomeBonus(userId);

    const afterUser = await User.findById(userId).lean();
    const afterPredCount = await Prediction.countDocuments({ userId });

    expect(afterUser.totalPoints).toBe(beforeUser.totalPoints);
    expect(afterPredCount).toBe(beforePredCount);
    expect(afterUser.balanceFubols).toBeGreaterThan(beforeUser.balanceFubols);
  });

  it('entry fee no altera totalPoints ni predicciones', async () => {
    const beforeUser = await User.findById(userId).lean();
    const beforePredCount = await Prediction.countDocuments({ userId });

    await chargeGroupEntryFee({ userId, groupId });

    const afterUser = await User.findById(userId).lean();
    const afterPredCount = await Prediction.countDocuments({ userId });

    expect(afterUser.totalPoints).toBe(beforeUser.totalPoints);
    expect(afterPredCount).toBe(beforePredCount);
  });
});
