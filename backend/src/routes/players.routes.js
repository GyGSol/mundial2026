import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { getPlayerSyncMeta } from '../services/playerSyncService.js';
import { getPlayerWikiSyncMeta } from '../services/playerWikiService.js';
import {
  askPlayerIntelFollowUp,
  getPlayerByIdWithIntel,
  listPlayersWithIntel,
  refreshPlayerIntel,
  refreshTeamPlayerIntel,
} from '../services/aiPlayerIntelService.js';
import { hasAiProvider } from '../services/aiPredictionService.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const result = await listPlayersWithIntel({
      page: req.query.page,
      limit: req.query.limit,
      team: req.query.team,
      position: req.query.position,
      status: req.query.status,
      q: req.query.q,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/meta', async (_req, res, next) => {
  try {
    const [meta, wikiMeta] = await Promise.all([getPlayerSyncMeta(), getPlayerWikiSyncMeta()]);
    res.json({
      ...meta,
      intelSource: 'ai',
      aiAvailable: hasAiProvider(),
      wikiSync: wikiMeta ?? null,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/ai/refresh-team', authMiddleware, async (req, res, next) => {
  try {
    if (!hasAiProvider()) {
      return res.status(503).json({ error: 'La IA no está configurada en el servidor' });
    }

    const team = String(req.body?.team ?? '').trim();
    if (!team) {
      return res.status(400).json({ error: 'Seleccioná una selección' });
    }

    const result = await refreshTeamPlayerIntel(team, { force: Boolean(req.body?.force) });
    res.json(result);
  } catch (err) {
    if (err.message === 'Selección no encontrada' || err.message === 'IA no configurada') {
      return res.status(400).json({ error: err.message });
    }
    if (err.message.includes('plantel local')) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const player = await getPlayerByIdWithIntel(req.params.id);
    if (!player) {
      return res.status(404).json({ error: 'Jugador no encontrado' });
    }
    res.json({ player, aiAvailable: hasAiProvider() });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/ai/refresh', authMiddleware, async (req, res, next) => {
  try {
    if (!hasAiProvider()) {
      return res.status(503).json({ error: 'La IA no está configurada en el servidor' });
    }

    const player = await refreshPlayerIntel(req.params.id);
    res.json({ player });
  } catch (err) {
    if (err.message === 'Jugador no encontrado' || err.message === 'IA no configurada') {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

router.post('/:id/ai/ask', authMiddleware, async (req, res, next) => {
  try {
    if (!hasAiProvider()) {
      return res.status(503).json({ error: 'La IA no está configurada en el servidor' });
    }

    const reply = await askPlayerIntelFollowUp(req.params.id, req.body?.question);
    res.json({ reply });
  } catch (err) {
    if (
      err.message === 'Jugador no encontrado' ||
      err.message === 'Escribí una pregunta' ||
      err.message === 'La pregunta es demasiado larga'
    ) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

export default router;
