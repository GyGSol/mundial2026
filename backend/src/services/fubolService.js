import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { FubolTransaction } from '../models/FubolTransaction.js';
import { AppTreasury } from '../models/AppTreasury.js';
import { PrizePool } from '../models/PrizePool.js';
import { GROUP_ENTRY_FEE, DEFAULT_PRIZE_SPLITS, WELCOME_BONUS_FUBOLS, AI_PLAY_BONUS_FUBOLS, AI_CONSULTATION_FEE } from '../config/economy.js';

function economyError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function runInTransaction(work) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } catch (err) {
    const msg = String(err?.message || '');
    const noTxn =
      err?.code === 20 ||
      msg.includes('Transaction numbers are only allowed') ||
      msg.includes('replica set');
    if (noTxn) {
      return work(null);
    }
    throw err;
  } finally {
    await session.endSession();
  }
}

export async function getTreasury(session = null) {
  const q = AppTreasury.findOneAndUpdate(
    { singletonKey: 'main' },
    { $setOnInsert: { singletonKey: 'main' } },
    { upsert: true, new: true }
  );
  if (session) q.session(session);
  return q;
}

export async function getLiquidFubols() {
  const treasury = await getTreasury();
  return Math.max(
    0,
    (treasury.totalDepositedFubols || 0) -
      (treasury.totalWithdrawnFubols || 0) -
      (treasury.houseBalanceFubols || 0)
  );
}

export async function getTotalUserBalances() {
  const agg = await User.aggregate([
    { $group: { _id: null, total: { $sum: { $ifNull: ['$balanceFubols', 0] } } } },
  ]);
  return agg[0]?.total ?? 0;
}

export async function computeMaxWithdrawal(userId) {
  const user = await User.findById(userId).select('balanceFubols').lean();
  if (!user) return 0;
  const balance = user.balanceFubols || 0;
  if (balance <= 0) return 0;

  const [liquid, totalBalances] = await Promise.all([getLiquidFubols(), getTotalUserBalances()]);
  if (totalBalances <= 0 || liquid <= 0) return 0;

  return Math.floor(balance * (liquid / totalBalances));
}

async function findIdempotentTx(idempotencyKey, session = null) {
  if (!idempotencyKey) return null;
  const q = FubolTransaction.findOne({ idempotencyKey });
  if (session) q.session(session);
  return q.lean();
}

export async function creditUser({
  userId,
  amount,
  type,
  metadata = {},
  idempotencyKey = null,
  groupId = null,
  session: externalSession = null,
  skipTreasuryDeposit = false,
}) {
  const amt = Math.round(Number(amount));
  if (!Number.isFinite(amt) || amt <= 0) {
    throw economyError('Monto de crédito inválido');
  }

  const work = async (session) => {
    if (idempotencyKey) {
      const existing = await findIdempotentTx(idempotencyKey, session);
      if (existing) {
        const user = await User.findById(userId).select('balanceFubols').lean();
        return {
          transaction: existing,
          balanceFubols: user?.balanceFubols ?? 0,
          duplicate: true,
        };
      }
    }

    const userQuery = User.findByIdAndUpdate(
      userId,
      { $inc: { balanceFubols: amt } },
      { new: true, session }
    );
    const user = await userQuery;
    if (!user) throw economyError('Usuario no encontrado', 404);

    const txPayload = {
      userId,
      type,
      amount: amt,
      balanceAfter: user.balanceFubols,
      groupId: groupId || null,
      metadata,
      idempotencyKey: idempotencyKey || undefined,
    };
    const txDocs = await FubolTransaction.create([txPayload], session ? { session } : undefined);
    const transaction = Array.isArray(txDocs) ? txDocs[0] : txDocs;

    if (type === 'deposit' && !skipTreasuryDeposit) {
      const treasury = await getTreasury(session);
      treasury.totalDepositedFubols = (treasury.totalDepositedFubols || 0) + amt;
      await treasury.save(session ? { session } : undefined);
    }

    return { transaction, balanceFubols: user.balanceFubols, duplicate: false };
  };

  if (externalSession) return work(externalSession);
  return runInTransaction(work);
}

export async function debitUser({
  userId,
  amount,
  type,
  metadata = {},
  idempotencyKey = null,
  groupId = null,
  session: externalSession = null,
}) {
  const amt = Math.round(Number(amount));
  if (!Number.isFinite(amt) || amt <= 0) {
    throw economyError('Monto de débito inválido');
  }

  const work = async (session) => {
    if (idempotencyKey) {
      const existing = await findIdempotentTx(idempotencyKey, session);
      if (existing) {
        const user = await User.findById(userId).select('balanceFubols').lean();
        return {
          transaction: existing,
          balanceFubols: user?.balanceFubols ?? 0,
          duplicate: true,
        };
      }
    }

    const user = await User.findOneAndUpdate(
      { _id: userId, balanceFubols: { $gte: amt } },
      { $inc: { balanceFubols: -amt } },
      { new: true, session }
    );
    if (!user) {
      throw economyError('Saldo insuficiente de Fubols', 402);
    }

    const txPayload = {
      userId,
      type,
      amount: -amt,
      balanceAfter: user.balanceFubols,
      groupId: groupId || null,
      metadata,
      idempotencyKey: idempotencyKey || undefined,
    };
    const txDocs = await FubolTransaction.create([txPayload], session ? { session } : undefined);
    const transaction = Array.isArray(txDocs) ? txDocs[0] : txDocs;

    return { transaction, balanceFubols: user.balanceFubols, duplicate: false };
  };

  if (externalSession) return work(externalSession);
  return runInTransaction(work);
}

async function ensurePrizePool(groupId, session = null) {
  const oid =
    typeof groupId === 'string' ? new mongoose.Types.ObjectId(groupId) : groupId;
  let query = PrizePool.findOne({ groupId: oid });
  if (session) query = query.session(session);
  let pool = await query;
  if (pool) return pool;

  const createOpts = session ? { session } : undefined;
  const created = await PrizePool.create(
    [
      {
        groupId: oid,
        totalFubols: 0,
        distributionPercents: [...DEFAULT_PRIZE_SPLITS],
        status: 'open',
      },
    ],
    createOpts
  );
  return Array.isArray(created) ? created[0] : created;
}

export async function chargeGroupEntryFee({ userId, groupId }) {
  const user = await User.findById(userId).select('isAiUser balanceFubols').lean();
  if (!user) throw economyError('Usuario no encontrado', 404);

  if (user.isAiUser) {
    return { charged: false, reason: 'ai_exempt', balanceFubols: user.balanceFubols || 0 };
  }

  const idempotencyKey = `entry:${userId}:${groupId}`;

  return runInTransaction(async (session) => {
    const existing = await findIdempotentTx(idempotencyKey, session);
    if (existing) {
      const fresh = await User.findById(userId).select('balanceFubols').lean();
      return {
        charged: false,
        reason: 'already_paid',
        balanceFubols: fresh?.balanceFubols ?? 0,
        transaction: existing,
      };
    }

    const debit = await debitUser({
      userId,
      amount: GROUP_ENTRY_FEE,
      type: 'entry_fee',
      groupId,
      idempotencyKey,
      metadata: { fee: GROUP_ENTRY_FEE },
      session,
    });

    const pool = await ensurePrizePool(groupId, session);
    pool.totalFubols = (pool.totalFubols || 0) + GROUP_ENTRY_FEE;
    await pool.save(session ? { session } : undefined);

    return {
      charged: true,
      balanceFubols: debit.balanceFubols,
      transaction: debit.transaction,
      prizePoolTotal: pool.totalFubols,
    };
  });
}

export async function recordDeposit({ userId, fubols, usd, sessionId }) {
  const idempotencyKey = sessionId ? `deposit:${sessionId}` : null;
  return creditUser({
    userId,
    amount: fubols,
    type: 'deposit',
    metadata: { usdAmount: usd, stripeSessionId: sessionId },
    idempotencyKey,
  });
}

export async function withdrawFubols({ userId, amount }) {
  const requested = Math.round(Number(amount));
  if (!Number.isFinite(requested) || requested <= 0) {
    throw economyError('Monto de retiro inválido');
  }

  const maxWithdrawal = await computeMaxWithdrawal(userId);
  if (requested > maxWithdrawal) {
    throw economyError(`El retiro máximo disponible es ${maxWithdrawal} Fubols`, 402);
  }

  return runInTransaction(async (session) => {
    const debit = await debitUser({
      userId,
      amount: requested,
      type: 'withdrawal',
      metadata: { requested },
      session,
    });

    const treasury = await getTreasury(session);
    treasury.totalWithdrawnFubols = (treasury.totalWithdrawnFubols || 0) + requested;
    await treasury.save(session ? { session } : undefined);

    return debit;
  });
}

export async function grantWelcomeBonus(userId) {
  return creditUser({
    userId,
    amount: WELCOME_BONUS_FUBOLS,
    type: 'welcome_bonus',
    idempotencyKey: `welcome:${userId}`,
    metadata: { reason: 'early_participant_bonus' },
    skipTreasuryDeposit: true,
  });
}

export async function grantAiPlayBonus(userId) {
  return creditUser({
    userId,
    amount: AI_PLAY_BONUS_FUBOLS,
    type: 'ai_play_bonus',
    idempotencyKey: `ai_play_bonus:${userId}`,
    metadata: { reason: 'ai_consultations' },
    skipTreasuryDeposit: true,
  });
}

export async function chargeAiConsultationFee({ userId }) {
  const user = await User.findById(userId).select('isAiUser balanceFubols').lean();
  if (!user) throw economyError('Usuario no encontrado', 404);
  if (user.isAiUser) {
    return { charged: false, reason: 'ai_exempt', balanceFubols: user.balanceFubols || 0 };
  }

  return runInTransaction(async (session) => {
    const debit = await debitUser({
      userId,
      amount: AI_CONSULTATION_FEE,
      type: 'ai_consultation',
      metadata: { fee: AI_CONSULTATION_FEE },
      session,
    });

    const treasury = await getTreasury(session);
    treasury.houseBalanceFubols = (treasury.houseBalanceFubols || 0) + AI_CONSULTATION_FEE;
    await treasury.save(session ? { session } : undefined);

    return {
      charged: true,
      balanceFubols: debit.balanceFubols,
      fee: AI_CONSULTATION_FEE,
    };
  });
}

export async function getTransactionHistory(userId, { limit = 50, cursor = null } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const filter = { userId };
  if (cursor) {
    filter.createdAt = { $lt: new Date(cursor) };
  }

  const rows = await FubolTransaction.find(filter)
    .sort({ createdAt: -1 })
    .limit(safeLimit + 1)
    .lean();

  const hasMore = rows.length > safeLimit;
  const items = hasMore ? rows.slice(0, safeLimit) : rows;

  return {
    items: items.map((row) => ({
      id: row._id.toString(),
      type: row.type,
      amount: row.amount,
      balanceAfter: row.balanceAfter,
      groupId: row.groupId?.toString() || null,
      metadata: row.metadata || {},
      createdAt: row.createdAt,
    })),
    nextCursor: hasMore ? items[items.length - 1].createdAt.toISOString() : null,
  };
}

export async function getUserBalanceSummary(userId) {
  const user = await User.findById(userId).select('balanceFubols').lean();
  if (!user) throw economyError('Usuario no encontrado', 404);

  const maxWithdrawal = await computeMaxWithdrawal(userId);
  const liquidFubols = await getLiquidFubols();

  return {
    balanceFubols: user.balanceFubols || 0,
    maxWithdrawal,
    liquidFubols,
  };
}
