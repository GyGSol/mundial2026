import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { aiConsultationBurstLimiter } from '../middleware/aiRateLimit.middleware.js';
import { AI_CONSULTATION_FEE, AI_QUESTIONS_PER_FEE } from '../config/economy.js';
import { User } from '../models/User.js';
import { buildAiCreditsPayload } from '../services/fubolService.js';
import { hasAiProvider } from '../services/aiPredictionService.js';
import {
  askConsultation,
  clearConsultationConversation,
  generateMatchInsight,
  getConsultationThread,
  isValidTopic,
  listConsultationThreads,
} from '../services/aiConsultationService.js';

const router = Router();

async function loadAiCredits(userId) {
  const user = await User.findById(userId).select('isAiUser aiQuestionCredits balanceFubols').lean();
  return buildAiCreditsPayload(user);
}

router.use(authMiddleware);
router.use(aiConsultationBurstLimiter);

router.get('/', async (req, res, next) => {
  try {
    const [threads, aiCredits] = await Promise.all([
      listConsultationThreads(req.user._id),
      loadAiCredits(req.user._id),
    ]);
    res.json({ threads, aiAvailable: hasAiProvider(), aiCredits });
  } catch (err) {
    next(err);
  }
});

router.get('/thread', async (req, res, next) => {
  try {
    const topicType = String(req.query.topicType ?? '').trim();
    const topicKey = String(req.query.topicKey ?? '').trim();
    if (!isValidTopic(topicType, topicKey)) {
      return res.status(400).json({ error: 'Tema de consulta inválido' });
    }

    const [result, aiCredits] = await Promise.all([
      getConsultationThread(req.user._id, topicType, topicKey),
      loadAiCredits(req.user._id),
    ]);
    res.json({ ...result, aiAvailable: hasAiProvider(), aiCredits });
  } catch (err) {
    next(err);
  }
});

router.post('/insight', async (req, res, next) => {
  try {
    if (!hasAiProvider()) {
      return res.status(503).json({ error: 'La IA no está configurada en el servidor' });
    }

    const matchId = String(req.body?.matchId ?? '').trim();
    if (!matchId) {
      return res.status(400).json({ error: 'Partido requerido' });
    }

    const result = await generateMatchInsight(req.user._id, matchId);
    res.json(result);
  } catch (err) {
    if (err.status === 402) {
      return res.status(402).json({
        error: err.message,
        code: 'insufficient_fubols',
        requiredFubols: AI_CONSULTATION_FEE,
        questionsPerPack: AI_QUESTIONS_PER_FEE,
      });
    }
    if (err.message === 'Partido no encontrado') {
      return res.status(404).json({ error: err.message });
    }
    if (err.message === 'IA no configurada') {
      return res.status(503).json({ error: 'La IA no está configurada en el servidor' });
    }
    if (err.status === 429 || err.code === 'ai_rate_limit') {
      return res.status(429).json({
        error: err.message,
        code: err.code ?? 'ai_rate_limit',
        retryAfterSec: err.retryAfterSec ?? 3600,
      });
    }
    next(err);
  }
});

router.post('/ask', async (req, res, next) => {
  try {
    if (!hasAiProvider()) {
      return res.status(503).json({ error: 'La IA no está configurada en el servidor' });
    }

    const result = await askConsultation(req.user._id, {
      topicType: req.body?.topicType,
      topicKey: req.body?.topicKey,
      question: req.body?.question,
      action: req.body?.action,
    });
    res.json(result);
  } catch (err) {
    if (err.status === 402) {
      return res.status(402).json({
        error: err.message,
        code: 'insufficient_fubols',
        requiredFubols: AI_CONSULTATION_FEE,
        questionsPerPack: AI_QUESTIONS_PER_FEE,
      });
    }
    const clientErrors = [
      'Tema de consulta inválido',
      'Escribí una pregunta',
      'La pregunta es demasiado larga',
      'Partido no encontrado',
    ];
    if (clientErrors.includes(err.message)) {
      return res.status(400).json({ error: err.message });
    }
    if (err.message === 'IA no configurada') {
      return res.status(503).json({ error: 'La IA no está configurada en el servidor' });
    }
    if (err.status === 429 || err.code === 'ai_rate_limit') {
      return res.status(429).json({
        error: err.message,
        code: err.code ?? 'ai_rate_limit',
        retryAfterSec: err.retryAfterSec ?? 3600,
      });
    }
    next(err);
  }
});

router.post('/clear-conversation', async (req, res, next) => {
  try {
    const topicType = String(req.body?.topicType ?? '').trim();
    const topicKey = String(req.body?.topicKey ?? '').trim();
    if (!isValidTopic(topicType, topicKey)) {
      return res.status(400).json({ error: 'Tema de consulta inválido' });
    }

    const result = await clearConsultationConversation(req.user._id, topicType, topicKey);
    res.json({ ...result, aiAvailable: hasAiProvider() });
  } catch (err) {
    if (err.message === 'Tema de consulta inválido') {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

export default router;
