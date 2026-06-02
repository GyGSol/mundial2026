import { Router } from 'express';
import { env } from '../config/env.js';
import { adminMiddleware } from '../middleware/admin.middleware.js';
import {
  finishLiveMatch,
  getSimulationStatus,
  resetSimulation,
  setupSimulation,
  startNextLiveMatch,
} from '../services/simulationService.js';

const router = Router();

function requireSimulationEnabled(req, res, next) {
  if (!env.simulationEnabled) {
    return res.status(404).json({ error: 'Simulación deshabilitada' });
  }
  next();
}

router.use(requireSimulationEnabled);
router.use(adminMiddleware);

router.get('/', async (req, res, next) => {
  try {
    res.json(await getSimulationStatus());
  } catch (err) {
    next(err);
  }
});

router.post('/setup', async (req, res, next) => {
  try {
    const playerCount = Number(req.body?.playerCount || 10);
    const matchCount = Number(req.body?.matchCount || 12);
    const mode = req.body?.mode === 'quick' ? 'quick' : 'full';
    res.status(201).json(
      await setupSimulation({
        playerCount: Math.min(Math.max(playerCount, 2), 20),
        matchCount: Math.min(Math.max(matchCount, 1), 30),
        mode,
      })
    );
  } catch (err) {
    next(err);
  }
});

router.post('/live', async (req, res, next) => {
  try {
    res.json(await startNextLiveMatch());
  } catch (err) {
    next(err);
  }
});

router.post('/finish', async (req, res, next) => {
  try {
    res.json(await finishLiveMatch());
  } catch (err) {
    next(err);
  }
});

router.delete('/', async (req, res, next) => {
  try {
    res.json(await resetSimulation());
  } catch (err) {
    next(err);
  }
});

export default router;
