import { Router } from 'express';
import { optionalAuth } from '../middleware/auth.middleware.js';
import {
  createCompetitionGroup,
  listCompetitionGroups,
} from '../services/competitionGroupService.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const groups = await listCompetitionGroups();
    res.json({ groups });
  } catch (err) {
    next(err);
  }
});

router.post('/', optionalAuth, async (req, res, next) => {
  try {
    const group = await createCompetitionGroup({
      name: req.body.name,
      description: req.body.description,
      createdBy: req.user?._id ?? null,
    });
    res.status(201).json({ group });
  } catch (err) {
    next(err);
  }
});

export default router;
