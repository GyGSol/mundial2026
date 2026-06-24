import { Router } from 'express';
import { Team } from '../models/Team.js';
import { fetchCoachWiki } from '../services/coachWikiService.js';
import { getTeamKit } from '../services/teamKitWikiService.js';

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

router.get('/teams/:fifaCode/kit', async (req, res, next) => {
  try {
    const fifaCode = String(req.params.fifaCode ?? '').trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(fifaCode)) {
      return res.status(400).json({ error: 'Código FIFA inválido' });
    }

    const kit = await getTeamKit(fifaCode);
    if (!kit?.parts?.body) {
      return res.status(404).json({ error: 'Indumentaria no disponible para esta selección' });
    }

    res.json({ kit });
  } catch (err) {
    next(err);
  }
});

router.get('/teams/coach-wiki', async (req, res, next) => {
  try {
    const name = String(req.query.name ?? '').trim();
    const fifaCode = String(req.query.fifaCode ?? '').trim().toUpperCase();
    let teamName = String(req.query.teamName ?? '').trim();

    if (!name) {
      return res.status(400).json({ error: 'Falta el nombre del técnico' });
    }

    if (!teamName && fifaCode) {
      const team = await Team.findOne({ fifaCode }).lean();
      teamName = team?.nameEn ?? '';
    }

    const wiki = await fetchCoachWiki({ name, fifaCode, teamName });
    if (!wiki) {
      return res.status(404).json({ error: 'No se encontró ficha del técnico en Wikipedia' });
    }

    res.json({ wiki });
  } catch (err) {
    next(err);
  }
});

export default router;
