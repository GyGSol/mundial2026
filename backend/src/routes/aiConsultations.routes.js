import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { hasAiProvider } from '../services/aiPredictionService.js';
import {
  askConsultation,
  generateMatchInsight,
  getConsultationThread,
  isValidTopic,
  listConsultationThreads,
} from '../services/aiConsultationService.js';

const router = Router();

router.use(authMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const threads = await listConsultationThreads(req.user._id);
    res.json({ threads, aiAvailable: hasAiProvider() });
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

    const result = await getConsultationThread(req.user._id, topicType, topicKey);
    res.json({ ...result, aiAvailable: hasAiProvider() });
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
    if (err.message === 'Partido no encontrado') {
      return res.status(404).json({ error: err.message });
    }
    if (err.message === 'IA no configurada') {
      return res.status(503).json({ error: 'La IA no está configurada en el servidor' });
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
    next(err);
  }
});

export default router;
