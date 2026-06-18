/**
 * Sincroniza mappings de transmisión desde la agenda La18HD (/eventos/json/agenda123.json)
 * hacia StreamLinkMapping para los partidos del día.
 *
 * Uso: node src/scripts/syncStreamMappings.js [--dry-run]
 */
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { Match } from '../models/Match.js';
import { Team } from '../models/Team.js';
import { resolveLa18StreamsForMatch } from '../services/la18hdScraper.js';
import { upsertStreamLinkMapping } from '../services/streamLinkService.js';
import { formatDayKey, TRANSMISSIONS_TIMEZONE } from '../services/transmissionService.js';

const dryRun = process.argv.includes('--dry-run');

function pickPreferredStream(streams) {
  if (!streams?.length) return null;
  return streams.find((s) => s.url.includes('/vivo/canales.php')) || streams[0];
}

await mongoose.connect(env.mongodbUri);

try {
  const today = formatDayKey(new Date(), TRANSMISSIONS_TIMEZONE);
  const windowStart = new Date(Date.now() - 36 * 60 * 60 * 1000);
  const windowEnd = new Date(Date.now() + 36 * 60 * 60 * 1000);

  const candidates = await Match.find({
    kickoffAt: { $gte: windowStart, $lte: windowEnd },
  })
    .sort({ kickoffAt: 1 })
    .lean();

  const dayMatches = candidates.filter(
    (match) => formatDayKey(match.kickoffAt, TRANSMISSIONS_TIMEZONE) === today
  );

  if (!dayMatches.length) {
    console.log(`Sin partidos para ${today} (${TRANSMISSIONS_TIMEZONE}).`);
    process.exit(0);
  }

  const teamIds = new Set();
  for (const match of dayMatches) {
    if (match.homeTeamId) teamIds.add(match.homeTeamId);
    if (match.awayTeamId) teamIds.add(match.awayTeamId);
  }

  const teams = teamIds.size
    ? await Team.find({ externalId: { $in: [...teamIds] } }).lean()
    : [];
  const teamById = Object.fromEntries(teams.map((team) => [team.externalId, team]));

  let mapped = 0;
  let skipped = 0;

  for (const match of dayMatches) {
    const homeTeam = teamById[match.homeTeamId] || null;
    const awayTeam = teamById[match.awayTeamId] || null;
    const label = `${homeTeam?.nameEn || match.homeTeamId} vs ${awayTeam?.nameEn || match.awayTeamId}`;

    const { event, streams } = await resolveLa18StreamsForMatch(match, {
      homeTeam,
      awayTeam,
      fetchImpl: fetch,
    });

    const stream = pickPreferredStream(streams);
    if (!stream?.url) {
      skipped += 1;
      console.log(`  · ${match.externalId} ${label} — sin señal en agenda`);
      continue;
    }

    mapped += 1;
    const notes = event?.title ? `Auto: ${event.title}` : 'Auto: agenda La18HD';
    console.log(`  ✓ ${match.externalId} ${label} → ${stream.label} (${stream.id})`);

    if (!dryRun) {
      await upsertStreamLinkMapping(
        match.externalId,
        {
          la18PageUrl: stream.url,
          embedUrl: stream.url,
          la18EventId: stream.eventId || stream.id,
          enabled: true,
          notes,
        },
        'syncStreamMappings'
      );
    }
  }

  console.log(
    `\n${dryRun ? '[dry-run] ' : ''}Mapeados: ${mapped}, sin agenda: ${skipped}, total: ${dayMatches.length}`
  );
} finally {
  await mongoose.disconnect();
}
