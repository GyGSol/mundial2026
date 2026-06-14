import { Router } from 'express';
import mongoose from 'mongoose';
import { authMiddleware, optionalAuth } from '../middleware/auth.middleware.js';
import {
  approveJoinRequest,
  createCompetitionGroup,
  deleteCompetitionGroup,
  getCompetitionGroupInvitePreview,
  isGroupAdmin,
  joinCompetitionGroup,
  leaveCompetitionGroup,
  listCompetitionGroupMembers,
  listCompetitionGroups,
  listGroupJoinRequests,
  listUserCompetitionGroups,
  countPendingApprovalsForUser,
  listUserPendingJoinRequests,
  rejectJoinRequest,
  removeGroupMember,
  requestJoinCompetitionGroup,
  setActiveCompetitionGroup,
  updateCompetitionGroup,
} from '../services/competitionGroupService.js';
import { getCompetitionGroupsPage } from '../services/competitionGroupsDashboardService.js';
import { CompetitionGroup } from '../models/CompetitionGroup.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const groups = await listCompetitionGroups();
    res.json({ groups });
  } catch (err) {
    next(err);
  }
});

router.get('/dashboard', optionalAuth, async (req, res, next) => {
  try {
    const page = await getCompetitionGroupsPage(req.user?._id);
    res.json(page);
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

router.get('/my/join-requests', authMiddleware, async (req, res, next) => {
  try {
    const pendingGroupIds = await listUserPendingJoinRequests(req.user._id);
    res.json({ pendingGroupIds });
  } catch (err) {
    next(err);
  }
});

router.get('/my/pending-approval-count', authMiddleware, async (req, res, next) => {
  try {
    const count = await countPendingApprovalsForUser(req.user._id);
    res.json({ count });
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

router.get('/:groupId/invite', async (req, res, next) => {
  try {
    const group = await getCompetitionGroupInvitePreview(req.params.groupId);
    res.json({ group });
  } catch (err) {
    next(err);
  }
});

router.get('/:groupId/members', optionalAuth, async (req, res, next) => {
  try {
    let includeRoles = false;
    const { groupId } = req.params;
    if (
      req.user &&
      groupId !== '__nogroup' &&
      mongoose.Types.ObjectId.isValid(groupId)
    ) {
      const group = await CompetitionGroup.findById(groupId);
      if (group && (await isGroupAdmin({ userId: req.user._id, group }))) {
        includeRoles = true;
      }
    }
    const members = await listCompetitionGroupMembers(groupId, { includeRoles });
    res.json({ members });
  } catch (err) {
    next(err);
  }
});

router.post('/:groupId/join-request', authMiddleware, async (req, res, next) => {
  try {
    const result = await requestJoinCompetitionGroup({
      userId: req.user._id,
      groupId: req.params.groupId,
    });
    res.status(result.status === 'pending' ? 202 : 201).json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/:groupId/join-requests', authMiddleware, async (req, res, next) => {
  try {
    const requests = await listGroupJoinRequests({
      groupId: req.params.groupId,
      userId: req.user._id,
    });
    res.json({ requests });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/:groupId/join-requests/:targetUserId/approve',
  authMiddleware,
  async (req, res, next) => {
    try {
      const result = await approveJoinRequest({
        groupId: req.params.groupId,
        targetUserId: req.params.targetUserId,
        userId: req.user._id,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:groupId/join-requests/:targetUserId/reject',
  authMiddleware,
  async (req, res, next) => {
    try {
      const result = await rejectJoinRequest({
        groupId: req.params.groupId,
        targetUserId: req.params.targetUserId,
        userId: req.user._id,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.delete('/:groupId/members/:targetUserId', authMiddleware, async (req, res, next) => {
  try {
    const result = await removeGroupMember({
      groupId: req.params.groupId,
      targetUserId: req.params.targetUserId,
      userId: req.user._id,
    });
    res.json(result);
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
