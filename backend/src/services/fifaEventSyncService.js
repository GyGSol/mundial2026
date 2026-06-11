import { Match } from '../models/Match.js';
import { Team } from '../models/Team.js';
import {
  fetchAllCalendarMatches,
  fetchMatchTimeline,
  resolveFifaMatchEntry,
} from './fifaApiClient.js';
import { parseFifaTimeline } from './fifaTimelineParser.js';
import { fetchFifaReportStats } from './fifaReportPdfService.js';

async function loadMatchTeams(match) {
  const [homeTeam, awayTeam] = await Promise.all([
    Team.findOne({ externalId: match.homeTeamId }).lean(),
    Team.findOne({ externalId: match.awayTeamId }).lean(),
  ]);
  return { homeTeam, awayTeam };
}

export async function syncFifaMatchEvents() {
  const recentCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [liveMatches, recentFinishedMatches] = await Promise.all([
    Match.find({ status: 'live' }).lean(),
    Match.find({ status: 'finished', kickoffAt: { $gte: recentCutoff } }).lean(),
  ]);

  const matchesToSync = [...liveMatches];
  for (const finished of recentFinishedMatches) {
    if (!matchesToSync.some((m) => m._id.toString() === finished._id.toString())) {
      matchesToSync.push(finished);
    }
  }

  if (!matchesToSync.length) return { matches: 0, events: 0 };

  let calendar = [];
  try {
    calendar = await fetchAllCalendarMatches();
  } catch (err) {
    console.warn('FIFA calendar sync skipped:', err.message);
    return { matches: 0, events: 0 };
  }

  let eventsSynced = 0;

  for (const match of matchesToSync) {
    const { homeTeam, awayTeam } = await loadMatchTeams(match);
    if (!homeTeam || !awayTeam) continue;

    try {
      const fifaEntry = await resolveFifaMatchEntry(calendar, match, homeTeam, awayTeam);
      if (!fifaEntry?.IdMatch || !fifaEntry?.IdStage) continue;

      const timelineJson = await fetchMatchTimeline({
        idStage: fifaEntry.IdStage,
        idMatch: fifaEntry.IdMatch,
      });

      const timeline = parseFifaTimeline(
        timelineJson,
        fifaEntry.Home?.IdTeam,
        fifaEntry.Away?.IdTeam
      );

      if (!timeline.length) continue;

      const rawUpdate = {
        'raw.fifaMeta': {
          idMatch: String(fifaEntry.IdMatch),
          idStage: String(fifaEntry.IdStage),
          matchNumber: Number(fifaEntry.MatchNumber ?? match.externalId),
          homeTeamId: String(fifaEntry.Home?.IdTeam ?? ''),
          awayTeamId: String(fifaEntry.Away?.IdTeam ?? ''),
          syncedAt: new Date().toISOString(),
        },
        'raw.fifaEvents': {
          timeline,
          source: 'fifa_api',
          syncedAt: new Date().toISOString(),
        },
      };

      if (match.status === 'finished' && !match.raw?.fifaReportStats) {
        const reportStats = await fetchFifaReportStats({
          matchNumber: Number(fifaEntry.MatchNumber ?? match.externalId),
          homeName: homeTeam.nameEn,
          awayName: awayTeam.nameEn,
        });
        if (reportStats) {
          rawUpdate['raw.fifaReportStats'] = reportStats;
        }
      }

      await Match.updateOne({ _id: match._id }, { $set: rawUpdate });
      eventsSynced += 1;
    } catch (err) {
      console.warn(`FIFA events sync skip match ${match.externalId}:`, err.message);
    }
  }

  return { matches: matchesToSync.length, events: eventsSynced };
}
