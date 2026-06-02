import dotenv from 'dotenv';
import { connectDb } from '../config/db.js';
import { Match } from '../models/Match.js';
import { Stadium } from '../models/Stadium.js';
import { resolveKickoffForStoredMatch, resolveOfficialKickoffAt } from '../services/kickoffTimeService.js';
import { ARGENTINA_TIMEZONE } from '../data/officialFixtureArgentina.js';
import { resolveStadiumTimezone } from '../services/stadiumTimezones.js';

dotenv.config();

async function ensureStadiumTimezones() {
  const stadiums = await Stadium.find();
  let updated = 0;

  for (const stadium of stadiums) {
    const timezone = stadium.timezone || resolveStadiumTimezone(stadium);
    if (!timezone || stadium.timezone === timezone) continue;
    stadium.timezone = timezone;
    await stadium.save();
    updated += 1;
  }

  return updated;
}

async function fixMatchKickoffs() {
  const stadiums = await Stadium.find().lean();
  const stadiumById = Object.fromEntries(stadiums.map((s) => [s.externalId, s]));
  const matches = await Match.find({
    externalId: { $not: /^sim-/ },
  });

  let fixed = 0;
  for (const match of matches) {
    const stadium = stadiumById[match.stadiumId];
    const kickoffAt = resolveKickoffForStoredMatch(match, stadium);
    if (!kickoffAt) continue;

    const official = resolveOfficialKickoffAt(match.externalId);
    const kickoffTimezone = official
      ? ARGENTINA_TIMEZONE
      : match.kickoffTimezone || stadium?.timezone || resolveStadiumTimezone(stadium || {});
    const sameTime =
      match.kickoffAt &&
      new Date(match.kickoffAt).getTime() === new Date(kickoffAt).getTime();
    const sameTz = (match.kickoffTimezone || null) === (kickoffTimezone || null);

    if (sameTime && sameTz) continue;

    match.kickoffAt = kickoffAt;
    if (kickoffTimezone) match.kickoffTimezone = kickoffTimezone;
    await match.save();
    fixed += 1;
    console.log(
      `  ${match.externalId}: ${match.localDate} → ${kickoffAt.toISOString()} (${kickoffTimezone || 'sin zona'})`
    );
  }

  return fixed;
}

async function main() {
  await connectDb();
  const stadiumsUpdated = await ensureStadiumTimezones();
  console.log(`Estadios con zona horaria actualizada: ${stadiumsUpdated}`);

  const matchesFixed = await fixMatchKickoffs();
  console.log(`Partidos con kickoff corregido: ${matchesFixed}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
