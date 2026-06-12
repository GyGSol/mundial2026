import { Match } from '../models/Match.js';
import { Team } from '../models/Team.js';
import {
  extractTeamAbbreviation,
  fetchAllCalendarMatches,
  fetchMatchTimeline,
  resolveFifaMatchEntry,
} from './fifaApiClient.js';
import { parseFifaTimeline } from './fifaTimelineParser.js';
import { fetchFifaReportStats, FIFA_REPORT_STATS_VERSION } from './fifaReportPdfService.js';
import { goalCountsFromTimeline } from './matchLiveData.js';

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

  if (!matchesToSync.length) return { matches: 0, events: 0, scoringIds: [] };

  let calendar = [];
  try {
    calendar = await fetchAllCalendarMatches();
  } catch (err) {
    console.warn('FIFA calendar sync skipped:', err.message);
    return { matches: 0, events: 0, scoringIds: [] };
  }

  let eventsSynced = 0;
  const scoringIds = [];

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

      const fifaHomeScore = Number(fifaEntry.Home?.Score);
      const fifaAwayScore = Number(fifaEntry.Away?.Score);
      const hasFifaScore = Number.isFinite(fifaHomeScore) && Number.isFinite(fifaAwayScore);

      const rawUpdate = {
        'raw.fifaMeta': {
          idMatch: String(fifaEntry.IdMatch),
          idStage: String(fifaEntry.IdStage),
          matchNumber: Number(fifaEntry.MatchNumber ?? match.externalId),
          homeTeamId: String(fifaEntry.Home?.IdTeam ?? ''),
          awayTeamId: String(fifaEntry.Away?.IdTeam ?? ''),
          ...(hasFifaScore ? { homeScore: fifaHomeScore, awayScore: fifaAwayScore } : {}),
          syncedAt: new Date().toISOString(),
        },
        'raw.fifaEvents': {
          timeline,
          source: 'fifa_api',
          syncedAt: new Date().toISOString(),
        },
      };

      if (match.status === 'finished') {
        const reportStats = match.raw?.fifaReportStats;
        const needsReportRefresh =
          !reportStats || reportStats.statsVersion !== FIFA_REPORT_STATS_VERSION;

        if (needsReportRefresh) {
          const freshReportStats = await fetchFifaReportStats({
            matchNumber: Number(fifaEntry.MatchNumber ?? match.externalId),
            homeName: homeTeam.nameEn,
            awayName: awayTeam.nameEn,
            homeFifaCode: homeTeam.fifaCode,
            awayFifaCode: awayTeam.fifaCode,
            homeAliases: [
              extractTeamAbbreviation(fifaEntry.Home),
              fifaEntry.Home?.TeamName?.find((item) => item.Locale === 'en-GB')?.Description,
            ],
            awayAliases: [
              extractTeamAbbreviation(fifaEntry.Away),
              fifaEntry.Away?.TeamName?.find((item) => item.Locale === 'en-GB')?.Description,
            ],
          });
          if (freshReportStats) {
            rawUpdate['raw.fifaReportStats'] = freshReportStats;
          }
        }
      }

      const timelineGoals = goalCountsFromTimeline(timeline);
      const resolvedHomeScore = hasFifaScore
        ? fifaHomeScore
        : Math.max(Number(match.homeScore ?? 0), timelineGoals.home);
      const resolvedAwayScore = hasFifaScore
        ? fifaAwayScore
        : Math.max(Number(match.homeScore ?? 0), timelineGoals.away);
      const scoreChanged =
        resolvedHomeScore !== Number(match.homeScore ?? 0) ||
        resolvedAwayScore !== Number(match.awayScore ?? 0);

      if (scoreChanged) {
        rawUpdate.homeScore = resolvedHomeScore;
        rawUpdate.awayScore = resolvedAwayScore;
        scoringIds.push(match._id);
      }

      await Match.updateOne({ _id: match._id }, { $set: rawUpdate });
      eventsSynced += 1;
    } catch (err) {
      console.warn(`FIFA events sync skip match ${match.externalId}:`, err.message);
    }
  }

  return { matches: matchesToSync.length, events: eventsSynced, scoringIds };
}
