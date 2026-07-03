/**
 * Pobla raw.fifaMeta.homeFieldScore / awayFieldScore desde cronología FIFA
 * y recalcula puntos. Uso:
 *   node src/scripts/backfillFieldScoresFromTimeline.js
 *   node src/scripts/backfillFieldScoresFromTimeline.js 27
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Match } from '../models/Match.js';
import { goalCountsFromTimeline, parseScorersField } from '../services/matchLiveData.js';
import { recalculateMatchScores } from '../services/matchScoringService.js';

dotenv.config();

const externalIds = process.argv.slice(2).map((id) => String(id).trim()).filter(Boolean);

function resolveFieldScoresFromMatchRaw(raw = {}) {
  const homeFromScorers = parseScorersField(raw.home_scorers ?? raw.homeScorers ?? '').length;
  const awayFromScorers = parseScorersField(raw.away_scorers ?? raw.awayScorers ?? '').length;
  if (homeFromScorers > 0 || awayFromScorers > 0) {
    return { homeFieldScore: homeFromScorers, awayFieldScore: awayFromScorers, source: 'scorers' };
  }

  const timeline = raw.fifaEvents?.timeline ?? [];
  const { home, away } = goalCountsFromTimeline(timeline);
  if (timeline.length > 0) {
    return { homeFieldScore: home, awayFieldScore: away, source: 'timeline' };
  }

  return null;
}

async function backfillMatch(match) {
  const meta = match.raw?.fifaMeta ?? {};
  const hasPenalties =
    Number.isFinite(Number(meta.homePenaltyScore)) ||
    Number.isFinite(Number(meta.awayPenaltyScore));

  if (!hasPenalties) {
    return { skipped: true, reason: 'sin penales en fifaMeta' };
  }

  if (meta.homeFieldScore != null && meta.awayFieldScore != null) {
    const recalc = await recalculateMatchScores(match._id);
    return { skipped: true, reason: 'field scores ya existían', recalc };
  }

  const timeline = match.raw?.fifaEvents?.timeline ?? [];
  const resolved = resolveFieldScoresFromMatchRaw(match.raw ?? {});

  if (!resolved) {
    return { skipped: true, reason: 'sin goleadores ni cronología' };
  }

  await Match.updateOne(
    { _id: match._id },
    {
      $set: {
        'raw.fifaMeta.homeFieldScore': resolved.homeFieldScore,
        'raw.fifaMeta.awayFieldScore': resolved.awayFieldScore,
      },
    }
  );

  const recalc = await recalculateMatchScores(match._id);
  return {
    updated: true,
    ...resolved,
    timelineLen: timeline.length,
    recalc,
  };
}

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI requerido');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const query = externalIds.length
    ? { externalId: { $in: externalIds } }
    : {
        status: 'finished',
        'raw.fifaMeta.homePenaltyScore': { $exists: true },
        $or: [
          { 'raw.fifaMeta.homeFieldScore': { $exists: false } },
          { 'raw.fifaMeta.awayFieldScore': { $exists: false } },
        ],
      };

  const matches = await Match.find(query)
    .select('_id externalId homeTeamId awayTeamId homeScore awayScore status raw')
    .lean();

  console.log(`Partidos a procesar: ${matches.length}`);

  let updated = 0;
  let skipped = 0;

  for (const match of matches) {
    const result = await backfillMatch(match);
    console.log(`externalId=${match.externalId} (${match.homeTeamId} vs ${match.awayTeamId}):`, result);
    if (result.updated) updated += 1;
    else skipped += 1;
  }

  console.log(`Listo: ${updated} actualizados, ${skipped} omitidos`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
