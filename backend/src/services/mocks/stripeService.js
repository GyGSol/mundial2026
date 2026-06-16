import { randomUUID } from 'crypto';
import { MOCK_CHECKOUT_USD, usdToFubols } from '../../config/economy.js';
import { recordDeposit } from './fubolService.js';

/** In-memory mock checkout sessions (no Stripe API). */
const pendingSessions = new Map();

export function createCheckoutSession({ userId, usdAmount = MOCK_CHECKOUT_USD }) {
  const usd = Number(usdAmount) || MOCK_CHECKOUT_USD;
  const sessionId = `mock_cs_${randomUUID()}`;
  pendingSessions.set(sessionId, {
    userId: String(userId),
    usdAmount: usd,
    status: 'pending',
    createdAt: Date.now(),
  });
  return {
    sessionId,
    usdAmount: usd,
    fubolsAmount: usdToFubols(usd),
    checkoutUrl: null,
  };
}

export async function completeCheckoutSession(sessionId) {
  const session = pendingSessions.get(sessionId);
  if (!session) {
    const error = new Error('Sesión de checkout no encontrada');
    error.status = 404;
    throw error;
  }

  if (session.status === 'completed') {
    return {
      sessionId,
      alreadyCompleted: true,
      fubols: usdToFubols(session.usdAmount),
      usd: session.usdAmount,
    };
  }

  const fubols = usdToFubols(session.usdAmount);
  const result = await recordDeposit({
    userId: session.userId,
    fubols,
    usd: session.usdAmount,
    sessionId,
  });

  session.status = 'completed';

  return {
    sessionId,
    alreadyCompleted: Boolean(result.duplicate),
    fubols,
    usd: session.usdAmount,
    balanceFubols: result.balanceFubols,
  };
}

export function getCheckoutSession(sessionId) {
  return pendingSessions.get(sessionId) || null;
}
