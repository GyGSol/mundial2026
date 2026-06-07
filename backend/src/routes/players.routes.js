import { Router } from 'express';
import { getPlayerById, listPlayers } from '../services/playerService.js';
import { getPlayerSyncMeta } from '../services/playerSyncService.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const result = await listPlayers({
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
    res.json(await getPlayerSyncMeta());
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const player = await getPlayerById(req.params.id);
    if (!player) {
      return res.status(404).json({ error: 'Jugador no encontrado' });
    }
    res.json({ player });
  } catch (err) {
    next(err);
  }
});

export default router;
