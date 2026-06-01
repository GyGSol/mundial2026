import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import {
  createCompetitionGroup,
  deleteCompetitionGroup,
  joinCompetitionGroup,
  leaveCompetitionGroup,
  listCompetitionGroupMembers,
  listCompetitionGroups,
  listUserCompetitionGroups,
  setActiveCompetitionGroup,
  updateCompetitionGroup,
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

router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const group = await createCompetitionGroup({
      name: req.body.name,
      description: req.body.description,
      createdBy: req.user._id,
      prizesWinnersCount: req.body.prizesWinnersCount,
      prizes: req.body.prizes,
    });
    res.status(201).json({ group });
  } catch (err) {
    next(err);
  }
});

router.get('/my', authMiddleware, async (req, res, next) => {
  try {
    const groups = await listUserCompetitionGroups(req.user._id);
    res.json({ groups });
  } catch (err) {
    next(err);
  }
});

router.post('/active', authMiddleware, async (req, res, next) => {
  try {
    const group = await setActiveCompetitionGroup({
      userId: req.user._id,
      groupId: req.body.groupId,
    });
    res.json({ group });
  } catch (err) {
    next(err);
  }
});

router.get('/:groupId/members', async (req, res, next) => {
  try {
    const members = await listCompetitionGroupMembers(req.params.groupId);
    res.json({ members });
  } catch (err) {
    next(err);
  }
});

router.post('/:groupId/leave', authMiddleware, async (req, res, next) => {
  try {
    const result = await leaveCompetitionGroup({
      userId: req.user._id,
      groupId: req.params.groupId,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/:groupId/join', authMiddleware, async (req, res, next) => {
  try {
    const group = await joinCompetitionGroup({
      userId: req.user._id,
      groupId: req.params.groupId,
    });
    res.status(201).json({ group });
  } catch (err) {
    next(err);
  }
});

router.put('/:groupId', authMiddleware, async (req, res, next) => {
  try {
    const group = await updateCompetitionGroup({
      groupId: req.params.groupId,
      name: req.body.name,
      description: req.body.description,
      userId: req.user._id,
      prizesWinnersCount: req.body.prizesWinnersCount,
      prizes: req.body.prizes,
    });
    res.json({ group });
  } catch (err) {
    next(err);
  }
});

router.delete('/:groupId', authMiddleware, async (req, res, next) => {
  try {
    const result = await deleteCompetitionGroup({
      groupId: req.params.groupId,
      userId: req.user._id,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
