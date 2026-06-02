import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { createUserSession, revokeSessionToken } from '../services/sessionService.js';
import {
  getCompetitionGroupById,
  listUserCompetitionGroups,
} from '../services/competitionGroupService.js';
import { UserGroupMembership } from '../models/UserGroupMembership.js';

const router = Router();

async function serializeUser(user) {
  // Backfill memberships for legacy users (single-group mode).
  if (user.competitionGroupId) {
    await UserGroupMembership.findOneAndUpdate(
      { userId: user._id, groupId: user.competitionGroupId },
      { $setOnInsert: { role: 'member' } },
      { upsert: true }
    );
  }

  const activeGroupId = user.activeCompetitionGroupId || user.competitionGroupId || null;
  const group = activeGroupId
    ? await getCompetitionGroupById(activeGroupId)
    : null;
  const groups = await listUserCompetitionGroups(user._id);

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    totalPoints: user.totalPoints,
    competitionGroup: group,
    competitionGroups: groups,
  };
}

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({
        error: 'Nombre, email y contraseña son obligatorios',
      });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      competitionGroupId: null,
      activeCompetitionGroupId: null,
    });

    const session = await createUserSession(user._id);
    res.status(201).json({
      token: session.token,
      expiresAt: session.expiresAt,
      user: await serializeUser(user),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase().trim() });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const session = await createUserSession(user._id);
    res.json({
      token: session.token,
      expiresAt: session.expiresAt,
      user: await serializeUser(user),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', authMiddleware, async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : '';
    await revokeSessionToken(token);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    res.json({ user: await serializeUser(req.user) });
  } catch (err) {
    next(err);
  }
});

router.patch('/me', authMiddleware, async (req, res, next) => {
  try {
    if (req.body?.email !== undefined) {
      return res.status(400).json({ error: 'El email no se puede modificar' });
    }

    const trimmedName = String(req.body?.name ?? '').trim();
    if (!trimmedName) {
      return res.status(400).json({ error: 'El nombre de jugador es obligatorio' });
    }

    if (trimmedName.length > 80) {
      return res.status(400).json({ error: 'El nombre no puede superar 80 caracteres' });
    }

    req.user.name = trimmedName;
    await req.user.save();

    res.json({ user: await serializeUser(req.user) });
  } catch (err) {
    next(err);
  }
});

export default router;
