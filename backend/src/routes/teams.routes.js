import { Router } from 'express';
import { Team } from '../models/Team.js';

const router = Router();

router.get('/teams', async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.group) filter.group = req.query.group;
    const teams = await Team.find(filter).sort({ nameEn: 1 });
    res.json({
      teams: teams.map((t) => ({
        id: t._id.toString(),
        externalId: t.externalId,
        nameEn: t.nameEn,
        nameFa: t.nameFa,
        fifaCode: t.fifaCode,
        group: t.group,
        flag: t.flag,
      })),
      total: teams.length,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
