import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { CompetitionGroup } from '../models/CompetitionGroup.js';
import { authMiddleware, signToken } from '../middleware/auth.middleware.js';
import { getCompetitionGroupById } from '../services/competitionGroupService.js';

const router = Router();

async function serializeUser(user) {
  const group = user.competitionGroupId
    ? await getCompetitionGroupById(user.competitionGroupId)
    : null;

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    totalPoints: user.totalPoints,
    competitionGroup: group,
  };
}

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, competitionGroupId } = req.body;
    if (!name?.trim() || !email?.trim() || !password || !competitionGroupId) {
      return res.status(400).json({
        error: 'Nombre, email, contraseña y grupo de competencia son obligatorios',
      });
    }

    const group = await CompetitionGroup.findById(competitionGroupId);
    if (!group) {
      return res.status(400).json({ error: 'El grupo seleccionado no existe' });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      competitionGroupId: group._id,
    });

    const token = signToken(user._id);
    res.status(201).json({
      token,
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

    const token = signToken(user._id);
    res.json({
      token,
      user: await serializeUser(user),
    });
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

export default router;
