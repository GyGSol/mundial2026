import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDb } from '../config/db.js';
import { Match } from '../models/Match.js';
import { Team } from '../models/Team.js';
import { Player } from '../models/Player.js';
import {
  probeLiveEventAssist,
  probeLiveEventAssistById,
} from '../services/liveMatchEventAssistService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

async function pickMatch(matchIdArg) {
  if (matchIdArg) {
    return Match.findById(matchIdArg).lean();
  }

  const live = await Match.find({ status: 'live' }).sort({ kickoffAt: -1 }).limit(1).lean();
  if (live[0]) return live[0];

  const recentCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const finished = await Match.find({
    status: 'finished',
    kickoffAt: { $gte: recentCutoff },
    'raw.fifaEvents.timeline.0': { $exists: true },
  })
    .sort({ kickoffAt: -1 })
    .limit(1)
    .lean();

  return finished[0] ?? null;
}

async function loadBundle(match) {
  const [homeTeam, awayTeam, homePlayers, awayPlayers] = await Promise.all([
    Team.findOne({ externalId: match.homeTeamId }).lean(),
    Team.findOne({ externalId: match.awayTeamId }).lean(),
    Player.find({ teamExternalId: match.homeTeamId }).lean(),
    Player.find({ teamExternalId: match.awayTeamId }).lean(),
  ]);
  return { homeTeam, awayTeam, homePlayers, awayPlayers };
}

async function main() {
  const matchIdArg = process.argv[2];
  const skipAi = process.argv.includes('--no-ai');

  await connectDb();

  const match = await pickMatch(matchIdArg);
  if (!match) {
    console.error('No hay partidos live ni finalizados recientes con timeline FIFA.');
    process.exit(1);
  }

  const [homeTeam, awayTeam] = await Promise.all([
    Team.findOne({ externalId: match.homeTeamId }).lean(),
    Team.findOne({ externalId: match.awayTeamId }).lean(),
  ]);

  console.log(
    `\n=== Probe asistencia IA en vivo ===\nPartido: ${homeTeam?.nameEn ?? '?'} vs ${awayTeam?.nameEn ?? '?'}`
  );
  console.log(`ID: ${match._id} · externalId: ${match.externalId} · status: ${match.status}\n`);

  const report = matchIdArg
    ? await probeLiveEventAssistById(matchIdArg, { invokeAi: !skipAi })
    : await probeLiveEventAssist(match, await loadBundle(match), { invokeAi: !skipAi });

  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
