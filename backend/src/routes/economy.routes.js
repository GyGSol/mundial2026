import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import {
  getUserBalanceSummary,
  getTransactionHistory,
  withdrawFubols,
} from '../services/fubolService.js';
import {
  createCheckoutSession,
  completeCheckoutSession,
} from '../services/mocks/stripeService.js';
import { MOCK_CHECKOUT_USD } from '../config/economy.js';

const router = Router();

router.use(authMiddleware);

router.get('/balance', async (req, res, next) => {
  try {
    const summary = await getUserBalanceSummary(req.user._id);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

router.get('/transactions', async (req, res, next) => {
  try {
    const history = await getTransactionHistory(req.user._id, {
      limit: req.query.limit,
      cursor: req.query.cursor,
    });
    res.json(history);
  } catch (err) {
    next(err);
  }
});

router.post('/checkout', async (req, res, next) => {
  try {
    const usdAmount = Number(req.body?.usdAmount) || MOCK_CHECKOUT_USD;
    const session = createCheckoutSession({
      userId: req.user._id,
      usdAmount,
    });
    res.status(201).json(session);
  } catch (err) {
    next(err);
  }
});

router.post('/webhook/mock', async (req, res, next) => {
  try {
    const sessionId = req.body?.sessionId;
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId es obligatorio' });
    }
    const result = await completeCheckoutSession(sessionId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/withdraw', async (req, res, next) => {
  try {
    const amount = Number(req.body?.amount);
    const result = await withdrawFubols({ userId: req.user._id, amount });
    res.json({
      balanceFubols: result.balanceFubols,
      transactionId: result.transaction._id?.toString?.() || result.transaction.id,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
