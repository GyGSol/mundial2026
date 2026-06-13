import { Match } from '../models/Match.js';
import { Team } from '../models/Team.js';
import {
  extractTeamAbbreviation,
  fetchAllCalendarMatches,
  fetchLiveMatchFootball,
  fetchMatchTimeline,
  resolveFifaMatchEntry,
} from './fifaApiClient.js';
import { parseFifaTimeline } from './fifaTimelineParser.js';
import { fetchFifaReportStats, FIFA_REPORT_STATS_VERSION } from './fifaReportPdfService.js';
import { goalCountsFromTimeline } from './matchLiveData.js';
import {
  applyShirtNumbersToTimeline,
  buildShirtByPlayerId,
} from '../utils/fifaSquadShirtMap.js';

async function loadMatchTeams(match) {
  const [homeTeam, awayTeam] = await Promise.all([
    Team.findOne({ externalId: match.homeTeamId }).lean(),
    Team.findOne({ externalId: match.awayTeamId }).lean(),
  ]);
  return { homeTeam, awayTeam };
}

export function needsFifaReportRefresh(match) {
  const reportStats = match.raw?.fifaReportStats;
  return !reportStats || reportStats.statsVersion !== FIFA_REPORT_STATS_VERSION;
}

function buildReportAliases(fifaSide, fallbackName) {
  if (!fifaSide) return [fallbackName].filter(Boolean);

  return [
    extractTeamAbbreviation(fifaSide),
    fifaSide?.TeamName?.find((item) => item.Locale === 'en-GB')?.Description,
    fallbackName,
  ].filter(Boolean);
}

/**
 * Descarga y parsea el reporte FIFA PDF para un partido finalizado.
 * No depende de la cronología FIFA.
 */
export async function syncFifaReportForFinishedMatch(match, homeTeam, awayTeam, fifaEntry = null) {
  if (match.status !== 'finished') return null;
  if (!needsFifaReportRefresh(match)) return null;

  const matchNumber = Number(
    fifaEntry?.MatchNumber ?? match.raw?.fifaMeta?.matchNumber ?? match.externalId
  );

  return fetchFifaReportStats({
    matchNumber,
    homeName: homeTeam.nameEn,
    awayName: awayTeam.nameEn,
    homeFifaCode: homeTeam.fifaCode,
    awayFifaCode: awayTeam.fifaCode,
    homeAliases: buildReportAliases(fifaEntry?.Home, homeTeam.nameEn),
    awayAliases: buildReportAliases(fifaEntry?.Away, awayTeam.nameEn),
  });
}

async function applyFinishedReportUpdate(match, homeTeam, awayTeam, fifaEntry, rawUpdate) {
  const freshReportStats = await syncFifaReportForFinishedMatch(
    match,
    homeTeam,
    awayTeam,
    fifaEntry
  );
  if (freshReportStats) {
    rawUpdate['raw.fifaReportStats'] = freshReportStats;
    return true;
  }
  return false;
}

/** Intenta fetch de reporte para partidos recién finalizados (p. ej. tras upsert worldcup26). */
export async function syncFifaReportsForMatchIds(matchIds = []) {
  if (!matchIds.length) return { reports: 0 };

  const matches = await Match.find({
    _id: { $in: matchIds },
    status: 'finished',
  }).lean();

  let reports = 0;

  for (const match of matches) {
    const { homeTeam, awayTeam } = await loadMatchTeams(match);
    if (!homeTeam || !awayTeam) continue;

    try {
      const rawUpdate = {};
      const updated = await applyFinishedReportUpdate(match, homeTeam, awayTeam, null, rawUpdate);
      if (updated) {
        await Match.updateOne({ _id: match._id }, { $set: rawUpdate });
        reports += 1;
      }
    } catch (err) {
      console.warn(`FIFA report sync skip match ${match.externalId}:`, err.message);
    }
  }

  return { reports };
}

export async function syncFifaMatchEvents({ extraMatchIds = [] } = {}) {
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

  if (extraMatchIds.length) {
    const extraMatches = await Match.find({ _id: { $in: extraMatchIds } }).lean();
    for (const extra of extraMatches) {
      if (!matchesToSync.some((m) => m._id.toString() === extra._id.toString())) {
        matchesToSync.push(extra);
      }
    }
  }

  if (!matchesToSync.length) return { matches: 0, events: 0, reports: 0, scoringIds: [] };

  let calendar = [];
  try {
    calendar = await fetchAllCalendarMatches();
  } catch (err) {
    console.warn('FIFA calendar sync skipped:', err.message);
    return { matches: 0, events: 0, reports: 0, scoringIds: [] };
  }

  let eventsSynced = 0;
  let reportsSynced = 0;
  const scoringIds = [];

  for (const match of matchesToSync) {
    const { homeTeam, awayTeam } = await loadMatchTeams(match);
    if (!homeTeam || !awayTeam) continue;

    try {
      const rawUpdate = {};
      let matchUpdated = false;

      const fifaEntry = await resolveFifaMatchEntry(calendar, match, homeTeam, awayTeam);

      if (fifaEntry?.IdMatch && fifaEntry?.IdStage) {
        const [timelineJson, liveMatch] = await Promise.all([
          fetchMatchTimeline({
            idStage: fifaEntry.IdStage,
            idMatch: fifaEntry.IdMatch,
          }),
          fetchLiveMatchFootball({
            idStage: fifaEntry.IdStage,
            idMatch: fifaEntry.IdMatch,
          }).catch(() => null),
        ]);

        let timeline = parseFifaTimeline(
          timelineJson,
          fifaEntry.Home?.IdTeam,
          fifaEntry.Away?.IdTeam
        );
        const shirtByPlayerId = liveMatch ? buildShirtByPlayerId(liveMatch) : {};
        if (Object.keys(shirtByPlayerId).length > 0) {
          timeline = applyShirtNumbersToTimeline(timeline, shirtByPlayerId);
        }

        if (timeline.length > 0) {
          const fifaHomeScore = Number(fifaEntry.Home?.Score);
          const fifaAwayScore = Number(fifaEntry.Away?.Score);
          const hasFifaScore = Number.isFinite(fifaHomeScore) && Number.isFinite(fifaAwayScore);

          rawUpdate['raw.fifaMeta'] = {
            idMatch: String(fifaEntry.IdMatch),
            idStage: String(fifaEntry.IdStage),
            matchNumber: Number(fifaEntry.MatchNumber ?? match.externalId),
            homeTeamId: String(fifaEntry.Home?.IdTeam ?? ''),
            awayTeamId: String(fifaEntry.Away?.IdTeam ?? ''),
            ...(Object.keys(shirtByPlayerId).length > 0 ? { shirtByPlayerId } : {}),
            ...(Object.keys(shirtByPlayerId).length > 0
              ? { shirtMapSyncedAt: new Date().toISOString() }
              : {}),
            ...(hasFifaScore ? { homeScore: fifaHomeScore, awayScore: fifaAwayScore } : {}),
            syncedAt: new Date().toISOString(),
          };
          rawUpdate['raw.fifaEvents'] = {
            timeline,
            rawEvents: timelineJson?.Event ?? [],
            source: 'fifa_api',
            syncedAt: new Date().toISOString(),
            assistHash: null,
            assistedAt: null,
          };

          const timelineGoals = goalCountsFromTimeline(timeline);
          const resolvedHomeScore = hasFifaScore
            ? fifaHomeScore
            : Math.max(Number(match.homeScore ?? 0), timelineGoals.home);
          const resolvedAwayScore = hasFifaScore
            ? fifaAwayScore
            : Math.max(Number(match.awayScore ?? 0), timelineGoals.away);
          const scoreChanged =
            resolvedHomeScore !== Number(match.homeScore ?? 0) ||
            resolvedAwayScore !== Number(match.awayScore ?? 0);

          if (scoreChanged) {
            rawUpdate.homeScore = resolvedHomeScore;
            rawUpdate.awayScore = resolvedAwayScore;
            scoringIds.push(match._id);
          }

          matchUpdated = true;
          eventsSynced += 1;
        }
      }

      if (match.status === 'finished') {
        const reportUpdated = await applyFinishedReportUpdate(
          match,
          homeTeam,
          awayTeam,
          fifaEntry,
          rawUpdate
        );
        if (reportUpdated) {
          matchUpdated = true;
          reportsSynced += 1;
        }
      }

      if (matchUpdated) {
        await Match.updateOne({ _id: match._id }, { $set: rawUpdate });
      }
    } catch (err) {
      console.warn(`FIFA events sync skip match ${match.externalId}:`, err.message);
    }
  }

  return {
    matches: matchesToSync.length,
    events: eventsSynced,
    reports: reportsSynced,
    scoringIds,
  };
}
