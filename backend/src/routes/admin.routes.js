import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  adminMiddleware,
  signAdminToken,
  verifyAdminCredentials,
} from '../middleware/admin.middleware.js';
import {
  getAdminSetupStatus,
  isAdminConfigured,
  setupAdminAccount,
} from '../services/adminSetupService.js';
import { runSync } from '../services/syncService.js';
import { getMatchPredictionDiagnostics } from '../services/predictionMatchLinkService.js';
import { runPlayerSync } from '../services/playerSyncService.js';
import {
  getEconomyOverview,
  projectPrizeDistribution,
  getOrCreatePrizePool,
  findAiBankStatusForGroup,
} from '../services/prizePoolService.js';
import {
  addAdminGroupMember,
  approveAdminJoinRequest,
  createAdminGroup,
  createAdminPrediction,
  createAdminUser,
  deleteAdminGroup,
  deleteAdminPrediction,
  deleteAdminUser,
  getAdminGroup,
  getAdminGroupMembers,
  getAdminStats,
  getAdminSyncStatus,
  getAdminUserById,
  listAdminGroupJoinRequests,
  listAdminGroups,
  listAdminMatches,
  listAdminPredictions,
  listAdminStreamLinks,
  listAdminTodayTransmissions,
  listAdminUsers,
  recalculateAdminMatch,
  recalculateAllFinishedMatches,
  rejectAdminJoinRequest,
  removeAdminGroupMember,
  suggestAdminStreamLinks,
  updateAdminGroup,
  updateAdminGroupMemberRole,
  updateAdminMatch,
  updateAdminMatchWeatherOps,
  updateAdminPrediction,
  updateAdminUserPassword,
  updateAdminUserPoints,
  updateAdminUserProfile,
  upsertAdminStreamLink,
  deleteAdminStreamLink,
} from '../services/adminService.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de login. Probá más tarde.' },
});

const setupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de configuración. Probá más tarde.' },
});

router.get('/setup/status', async (req, res, next) => {
  try {
    res.json(await getAdminSetupStatus());
  } catch (err) {
    next(err);
  }
});

router.post('/setup', setupLimiter, async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? '').trim();
    const password = String(req.body?.password ?? '');
    const confirmPassword = String(req.body?.confirmPassword ?? '');

    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Las contraseñas no coinciden' });
    }

    const { username: createdUsername } = await setupAdminAccount({ username, password });

    res.status(201).json({
      configured: true,
      username: createdUsername,
      token: signAdminToken(),
      admin: { username: createdUsername, role: 'admin' },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? '').trim();
    const password = String(req.body?.password ?? '');

    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    }

    if (!(await isAdminConfigured())) {
      return res.status(403).json({
        error: 'Administrador sin configurar. Completá el primer ingreso en /admin/setup.',
        needsSetup: true,
      });
    }

    const valid = await verifyAdminCredentials(username, password);
    if (!valid) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    res.json({
      token: signAdminToken(),
      admin: { username, role: 'admin' },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', adminMiddleware, (req, res) => {
  res.json({ ok: true });
});

router.get('/me', adminMiddleware, (req, res) => {
  res.json({ admin: { role: 'admin' } });
});

router.get('/stats', adminMiddleware, async (req, res, next) => {
  try {
    res.json(await getAdminStats());
  } catch (err) {
    next(err);
  }
});

router.get('/sync', adminMiddleware, async (req, res, next) => {
  try {
    res.json(await getAdminSyncStatus());
  } catch (err) {
    next(err);
  }
});

router.post('/sync/run', adminMiddleware, async (req, res, next) => {
  try {
    const result = await runSync({ includeMetadata: true });
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});

router.post('/sync/players', adminMiddleware, async (req, res, next) => {
  try {
    const result = await runPlayerSync();
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});

router.get('/users', adminMiddleware, async (req, res, next) => {
  try {
    res.json(
      await listAdminUsers({
        page: req.query.page,
        limit: req.query.limit,
        q: req.query.q,
      })
    );
  } catch (err) {
    next(err);
  }
});

router.post('/users', adminMiddleware, async (req, res, next) => {
  try {
    res.status(201).json(
      await createAdminUser({
        name: req.body?.name,
        email: req.body?.email,
        password: req.body?.password,
        totalPoints: req.body?.totalPoints,
      })
    );
  } catch (err) {
    next(err);
  }
});

router.get('/users/:id', adminMiddleware, async (req, res, next) => {
  try {
    res.json(await getAdminUserById(req.params.id));
  } catch (err) {
    next(err);
  }
});

router.patch('/users/:id', adminMiddleware, async (req, res, next) => {
  try {
    const { totalPoints, password, name, email } = req.body ?? {};
    if (
      totalPoints === undefined &&
      password === undefined &&
      name === undefined &&
      email === undefined
    ) {
      return res.status(400).json({ error: 'Indicá al menos un campo a actualizar' });
    }

    let user;
    if (name !== undefined || email !== undefined) {
      user = await updateAdminUserProfile(req.params.id, { name, email });
    }
    if (totalPoints !== undefined) {
      user = await updateAdminUserPoints(req.params.id, totalPoints);
    }
    if (password !== undefined) {
      user = await updateAdminUserPassword(req.params.id, password);
    }

    res.json(user);
  } catch (err) {
    next(err);
  }
});

router.delete('/users/:id', adminMiddleware, async (req, res, next) => {
  try {
    res.json(await deleteAdminUser(req.params.id));
  } catch (err) {
    next(err);
  }
});

router.get('/groups', adminMiddleware, async (req, res, next) => {
  try {
    res.json({ groups: await listAdminGroups() });
  } catch (err) {
    next(err);
  }
});

router.post('/groups', adminMiddleware, async (req, res, next) => {
  try {
    const group = await createAdminGroup({
      name: req.body.name,
      description: req.body.description,
      prizesWinnersCount: req.body.prizesWinnersCount,
      prizes: req.body.prizes,
    });
    res.status(201).json({ group });
  } catch (err) {
    next(err);
  }
});

router.get('/groups/:id', adminMiddleware, async (req, res, next) => {
  try {
    res.json({ group: await getAdminGroup(req.params.id) });
  } catch (err) {
    next(err);
  }
});

router.patch('/groups/:id', adminMiddleware, async (req, res, next) => {
  try {
    const group = await updateAdminGroup({
      groupId: req.params.id,
      name: req.body.name,
      description: req.body.description,
      prizesWinnersCount: req.body.prizesWinnersCount,
      prizes: req.body.prizes,
    });
    const prizePool =
      (group.prizesWinnersCount || 0) > 0
        ? await projectPrizeDistribution(req.params.id)
        : null;
    res.json({ group, prizePool });
  } catch (err) {
    next(err);
  }
});

router.get('/groups/:id/members', adminMiddleware, async (req, res, next) => {
  try {
    res.json({ members: await getAdminGroupMembers(req.params.id) });
  } catch (err) {
    next(err);
  }
});

router.post('/groups/:id/members', adminMiddleware, async (req, res, next) => {
  try {
    res.status(201).json(
      await addAdminGroupMember({
        groupId: req.params.id,
        email: req.body.email,
        userId: req.body.userId,
      })
    );
  } catch (err) {
    next(err);
  }
});

router.delete('/groups/:id/members/:userId', adminMiddleware, async (req, res, next) => {
  try {
    res.json(
      await removeAdminGroupMember({
        groupId: req.params.id,
        userId: req.params.userId,
      })
    );
  } catch (err) {
    next(err);
  }
});

router.patch('/groups/:id/members/:userId', adminMiddleware, async (req, res, next) => {
  try {
    if (req.body?.role === undefined) {
      return res.status(400).json({ error: 'role requerido' });
    }
    res.json(
      await updateAdminGroupMemberRole({
        groupId: req.params.id,
        userId: req.params.userId,
        role: req.body.role,
      })
    );
  } catch (err) {
    next(err);
  }
});

router.get('/groups/:id/join-requests', adminMiddleware, async (req, res, next) => {
  try {
    res.json({ requests: await listAdminGroupJoinRequests(req.params.id) });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/groups/:id/join-requests/:userId/approve',
  adminMiddleware,
  async (req, res, next) => {
    try {
      res.json(
        await approveAdminJoinRequest({
          groupId: req.params.id,
          userId: req.params.userId,
        })
      );
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/groups/:id/join-requests/:userId/reject',
  adminMiddleware,
  async (req, res, next) => {
    try {
      res.json(
        await rejectAdminJoinRequest({
          groupId: req.params.id,
          userId: req.params.userId,
        })
      );
    } catch (err) {
      next(err);
    }
  }
);

router.delete('/groups/:id', adminMiddleware, async (req, res, next) => {
  try {
    res.json(await deleteAdminGroup(req.params.id));
  } catch (err) {
    next(err);
  }
});

router.get('/matches', adminMiddleware, async (req, res, next) => {
  try {
    res.json({
      matches: await listAdminMatches({
        status: req.query.status,
        group: req.query.group,
      }),
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/matches/:id', adminMiddleware, async (req, res, next) => {
  try {
    res.json(
      await updateAdminMatch(req.params.id, {
        homeScore: req.body?.homeScore,
        awayScore: req.body?.awayScore,
        status: req.body?.status,
        group: req.body?.group,
        matchday: req.body?.matchday,
        kickoffAt: req.body?.kickoffAt,
        weatherOps: req.body?.weatherOps,
      })
    );
  } catch (err) {
    next(err);
  }
});

router.post('/matches/:id/weather-ops', adminMiddleware, async (req, res, next) => {
  try {
    res.json(await updateAdminMatchWeatherOps(req.params.id, req.body?.weatherOps ?? req.body));
  } catch (err) {
    next(err);
  }
});

router.post('/matches/recalculate-all', adminMiddleware, async (req, res, next) => {
  try {
    res.json(await recalculateAllFinishedMatches());
  } catch (err) {
    next(err);
  }
});

router.post('/matches/:id/recalculate', adminMiddleware, async (req, res, next) => {
  try {
    res.json(await recalculateAdminMatch(req.params.id));
  } catch (err) {
    next(err);
  }
});

router.get('/stream-links', adminMiddleware, async (req, res, next) => {
  try {
    res.json({ streamLinks: await listAdminStreamLinks() });
  } catch (err) {
    next(err);
  }
});

router.get('/transmissions/today', adminMiddleware, async (req, res, next) => {
  try {
    res.json(await listAdminTodayTransmissions());
  } catch (err) {
    next(err);
  }
});

router.get('/stream-links/suggest', adminMiddleware, async (req, res, next) => {
  try {
    res.json(await suggestAdminStreamLinks(req.query.matchId));
  } catch (err) {
    next(err);
  }
});

router.put('/stream-links/:matchExternalId', adminMiddleware, async (req, res, next) => {
  try {
    res.json(
      await upsertAdminStreamLink(req.params.matchExternalId, req.body ?? {}, 'admin')
    );
  } catch (err) {
    if (err.message?.includes('no encontrado') || err.message?.includes('requerido')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

router.delete('/stream-links/:matchExternalId', adminMiddleware, async (req, res, next) => {
  try {
    const deleted = await deleteAdminStreamLink(req.params.matchExternalId);
    if (!deleted) return res.status(404).json({ error: 'Mapping no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/predictions/diagnostics', adminMiddleware, async (req, res, next) => {
  try {
    res.json({
      diagnostics: await getMatchPredictionDiagnostics(req.query.matchNumber),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/predictions', adminMiddleware, async (req, res, next) => {
  try {
    res.json({
      predictions: await listAdminPredictions({
        userId: req.query.userId,
        matchId: req.query.matchId,
        matchNumber: req.query.matchNumber,
        status: req.query.status,
        group: req.query.group,
        scored: req.query.scored,
        source: req.query.source,
      }),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/predictions', adminMiddleware, async (req, res, next) => {
  try {
    res.status(201).json(
      await createAdminPrediction({
        userId: req.body?.userId,
        matchId: req.body?.matchId,
        homeGoals: req.body?.homeGoals,
        awayGoals: req.body?.awayGoals,
      })
    );
  } catch (err) {
    next(err);
  }
});

router.patch('/predictions/:id', adminMiddleware, async (req, res, next) => {
  try {
    res.json(
      await updateAdminPrediction(req.params.id, {
        homeGoals: req.body?.homeGoals,
        awayGoals: req.body?.awayGoals,
        pointsEarned: req.body?.pointsEarned,
        bonusPoint: req.body?.bonusPoint,
      })
    );
  } catch (err) {
    next(err);
  }
});

router.delete('/predictions/:id', adminMiddleware, async (req, res, next) => {
  try {
    res.json(await deleteAdminPrediction(req.params.id));
  } catch (err) {
    next(err);
  }
});

router.get('/economy/overview', adminMiddleware, async (req, res, next) => {
  try {
    res.json(await getEconomyOverview());
  } catch (err) {
    next(err);
  }
});

router.get('/economy/groups/:groupId', adminMiddleware, async (req, res, next) => {
  try {
    const groupId = req.params.groupId;
    const [pool, projection, bankStatus] = await Promise.all([
      getOrCreatePrizePool(groupId),
      projectPrizeDistribution(groupId),
      findAiBankStatusForGroup(groupId),
    ]);
    res.json({
      groupId,
      prizePool: {
        totalFubols: pool.totalFubols,
        distributionPercents: pool.distributionPercents,
        status: pool.status,
      },
      projection,
      bankStatus,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
