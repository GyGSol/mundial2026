import { Match } from '../models/Match.js';
import { Team } from '../models/Team.js';
import {
  extractTeamAbbreviation,
  fetchAllCalendarMatches,
  getCachedAllCalendarMatches,
  fetchLiveMatchFootball,
  fetchMatchTimeline,
  resolveFifaMatchEntry,
} from './fifaApiClient.js';
import {
  parseFifaTimeline,
  parsedTimelineHasMatchEnd,
  fifaRawTimelineHasMatchEnd,
} from './fifaTimelineParser.js';
import { fetchFifaReportStats, FIFA_REPORT_STATS_VERSION } from './fifaReportPdfService.js';
import {
  goalCountsFromTimeline,
  isPlausibleMatchGoalCount,
  mergeFifaApiScoreWithTimeline,
  mergePlausibleGoalCounts,
  findNewTimelineGoals,
} from './matchLiveData.js';
import {
  applyShirtNumbersToTimeline,
  buildShirtLookups,
} from '../utils/fifaSquadShirtMap.js';
import { applyStatusTransitionFields } from './matchDisplayVisibilityService.js';
import { wallClockAllowsMatchFinished, fifaEntryIndicatesFinished } from './matchStatusRules.js';
import { knockoutTieBlocksMatchFinish } from './knockoutExtraTimeRules.js';
import { env } from '../config/env.js';
import { buildFifaLineupSides } from './fifaLineupService.js';
import { buildLineupSnapshotFromSources } from './matchLineupService.js';
import { extractFifaLiveState } from './matchPlayStateService.js';
import { readFifaPenaltyShootoutScores } from './penaltyShootoutService.js';

/** Máxima antigüedad de raw.fifaEvents.syncedAt antes de refrescar en el loop en vivo. */
export const LIVE_FIFA_EVENTS_MAX_AGE_MS = env.liveFifaRefreshMs;

export function readFifaEventsSyncedAtMs(match) {
  const syncedAt = match?.raw?.fifaEvents?.syncedAt ?? match?.raw?.fifaMeta?.syncedAt;
  if (!syncedAt) return null;
  const ms = new Date(syncedAt).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function isLiveFifaEventsStale(match, maxAgeMs = LIVE_FIFA_EVENTS_MAX_AGE_MS, now = Date.now()) {
  if (match?.status !== 'live') return false;
  const syncedMs = readFifaEventsSyncedAtMs(match);
  if (syncedMs == null) return true;
  return now - syncedMs >= maxAgeMs;
}

function buildFifaEntryFromStoredMeta(match) {
  const meta = match?.raw?.fifaMeta;
  if (!meta?.idMatch || !meta?.idStage) return null;

  return {
    IdMatch: meta.idMatch,
    IdStage: meta.idStage,
    MatchNumber: meta.matchNumber ?? match.externalId,
    Home: {
      IdTeam: meta.homeTeamId,
      Score: meta.homeScore ?? match.homeScore,
    },
    Away: {
      IdTeam: meta.awayTeamId,
      Score: meta.awayScore ?? match.awayScore,
    },
  };
}

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

async function syncSingleMatchFifaEvents(match, homeTeam, awayTeam, fifaEntry) {
  if (!fifaEntry?.IdMatch || !fifaEntry?.IdStage) {
    return {
      events: 0,
      reports: 0,
      scoringIds: [],
      newlyFinishedIds: [],
      newlyLiveIds: [],
      goalUpdates: [],
      updated: false,
    };
  }

  const previousTimeline = match.raw?.fifaEvents?.timeline ?? [];

  const rawUpdate = {};
  let matchUpdated = false;
  let reportsSynced = 0;

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

  let timeline = parseFifaTimeline(timelineJson, fifaEntry.Home?.IdTeam, fifaEntry.Away?.IdTeam);
  const shirtLookups = liveMatch
    ? buildShirtLookups(liveMatch)
    : { shirtByPlayerId: {}, shirtBySideName: { home: {}, away: {} } };
  const { shirtByPlayerId, shirtBySideName } = shirtLookups;
  if (Object.keys(shirtByPlayerId).length > 0) {
    timeline = applyShirtNumbersToTimeline(timeline, shirtLookups);
  }

  if (liveMatch) {
    rawUpdate['raw.fifaLiveState'] = extractFifaLiveState(liveMatch, fifaEntry);
    const sides = buildFifaLineupSides(liveMatch);
    if (sides.home?.players?.length || sides.away?.players?.length) {
      rawUpdate['raw.lineupSnapshot'] = buildLineupSnapshotFromSources({
        fdSides: {
          home: sides.home ?? { formation: null, players: [], coach: null },
          away: sides.away ?? { formation: null, players: [], coach: null },
        },
        source: 'fifa-live',
      });
    }
  }

  if (timeline.length === 0) {
    if (rawUpdate['raw.lineupSnapshot']) {
      rawUpdate['raw.fifaMeta'] = {
        idMatch: String(fifaEntry.IdMatch),
        idStage: String(fifaEntry.IdStage),
        matchNumber: Number(fifaEntry.MatchNumber ?? match.externalId),
        homeTeamId: String(fifaEntry.Home?.IdTeam ?? ''),
        awayTeamId: String(fifaEntry.Away?.IdTeam ?? ''),
        ...(Object.keys(shirtByPlayerId).length > 0 ? { shirtByPlayerId, shirtBySideName } : {}),
        ...(Object.keys(shirtByPlayerId).length > 0
          ? { shirtMapSyncedAt: new Date().toISOString() }
          : {}),
        syncedAt: new Date().toISOString(),
      };
      await Match.updateOne({ _id: match._id }, { $set: rawUpdate });
      return {
        events: 0,
        reports: 0,
        scoringIds: [],
        newlyFinishedIds: [],
        newlyLiveIds: [],
        goalUpdates: [],
        updated: true,
      };
    }
    return {
      events: 0,
      reports: 0,
      scoringIds: [],
      newlyFinishedIds: [],
      newlyLiveIds: [],
      goalUpdates: [],
      updated: false,
    };
  }

  const scoringIds = [];
  const newlyFinishedIds = [];

  const fifaHomeScore = Number(fifaEntry.Home?.Score);
  const fifaAwayScore = Number(fifaEntry.Away?.Score);
  const hasFifaScore =
    Number.isFinite(fifaHomeScore) &&
    Number.isFinite(fifaAwayScore) &&
    isPlausibleMatchGoalCount(fifaHomeScore) &&
    isPlausibleMatchGoalCount(fifaAwayScore);

  const timelineGoals = goalCountsFromTimeline(timeline);
  const mergedScores = mergeFifaApiScoreWithTimeline(
    fifaHomeScore,
    fifaAwayScore,
    timeline,
    hasFifaScore
  );
  const resolvedHomeScore = hasFifaScore
    ? mergedScores.homeScore
    : mergePlausibleGoalCounts(match.homeScore, mergedScores.homeScore);
  const resolvedAwayScore = hasFifaScore
    ? mergedScores.awayScore
    : mergePlausibleGoalCounts(match.awayScore, mergedScores.awayScore);

  const penaltyScores = readFifaPenaltyShootoutScores(fifaEntry);
  const winnerTeamId = fifaEntry?.Winner != null ? String(fifaEntry.Winner) : null;

  rawUpdate['raw.fifaMeta'] = {
    idMatch: String(fifaEntry.IdMatch),
    idStage: String(fifaEntry.IdStage),
    matchNumber: Number(fifaEntry.MatchNumber ?? match.externalId),
    homeTeamId: String(fifaEntry.Home?.IdTeam ?? ''),
    awayTeamId: String(fifaEntry.Away?.IdTeam ?? ''),
    ...(Object.keys(shirtByPlayerId).length > 0 ? { shirtByPlayerId, shirtBySideName } : {}),
    ...(Object.keys(shirtByPlayerId).length > 0
      ? { shirtMapSyncedAt: new Date().toISOString() }
      : {}),
    ...(hasFifaScore || timelineGoals.home + timelineGoals.away > 0
      ? { homeScore: mergedScores.homeScore, awayScore: mergedScores.awayScore }
      : {}),
    ...(penaltyScores
      ? {
          homePenaltyScore: penaltyScores.homeScore,
          awayPenaltyScore: penaltyScores.awayScore,
        }
      : {}),
    ...(winnerTeamId ? { winnerTeamId } : {}),
    ...(fifaEntry?.Period != null ? { period: String(fifaEntry.Period) } : {}),
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
  const scoreChanged =
    resolvedHomeScore !== Number(match.homeScore ?? 0) ||
    resolvedAwayScore !== Number(match.awayScore ?? 0);

  if (scoreChanged) {
    rawUpdate.homeScore = resolvedHomeScore;
    rawUpdate.awayScore = resolvedAwayScore;
    scoringIds.push(match._id);
  }

  if (match.status === 'upcoming' && (scoreChanged || timeline.length > 0)) {
    rawUpdate.status = 'live';
    rawUpdate.weatherOps = { phase: 'normal' };
    scoringIds.push(match._id);
  }

  const hasMatchEnd =
    parsedTimelineHasMatchEnd(timeline) || fifaRawTimelineHasMatchEnd(timelineJson);
  if (match.status === 'live' && hasMatchEnd) {
    const finishedCandidate = {
      ...match,
      status: 'finished',
      homeScore: rawUpdate.homeScore ?? match.homeScore,
      awayScore: rawUpdate.awayScore ?? match.awayScore,
      raw: {
        ...(match.raw ?? {}),
        finished: 'TRUE',
        time_elapsed: 'finished',
        fifaEvents: {
          ...(match.raw?.fifaEvents ?? {}),
          timeline,
        },
      },
    };
    if (wallClockAllowsMatchFinished(finishedCandidate)) {
      rawUpdate.status = 'finished';
      rawUpdate['raw.time_elapsed'] = 'finished';
      rawUpdate['raw.finished'] = 'TRUE';
      newlyFinishedIds.push(match._id);
      scoringIds.push(match._id);
    }
  } else if (
    match.status === 'live' &&
    fifaEntry &&
    fifaEntryIndicatesFinished(fifaEntry, match) &&
    !knockoutTieBlocksMatchFinish(match, fifaEntry)
  ) {
    const finishedCandidate = {
      ...match,
      status: 'finished',
      homeScore: rawUpdate.homeScore ?? match.homeScore,
      awayScore: rawUpdate.awayScore ?? match.awayScore,
      raw: {
        ...(match.raw ?? {}),
        finished: 'TRUE',
        time_elapsed: 'finished',
        fifaEvents: {
          ...(match.raw?.fifaEvents ?? {}),
          timeline,
        },
      },
    };
    if (wallClockAllowsMatchFinished(finishedCandidate)) {
      rawUpdate.status = 'finished';
      rawUpdate['raw.time_elapsed'] = 'finished';
      rawUpdate['raw.finished'] = 'TRUE';
      newlyFinishedIds.push(match._id);
      scoringIds.push(match._id);
    }
  }

  matchUpdated = true;

  const effectiveStatus = rawUpdate.status ?? match.status;
  if (effectiveStatus === 'finished') {
    const reportUpdated = await applyFinishedReportUpdate(
      { ...match, status: 'finished' },
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
    applyStatusTransitionFields(rawUpdate, {
      previousStatus: match.status,
      nextStatus: effectiveStatus,
      existingFinishedAt: match.finishedAt ?? null,
    });
    await Match.updateOne({ _id: match._id }, { $set: rawUpdate });
  }

  const becameLive = match.status === 'upcoming' && effectiveStatus === 'live';
  const resolvedHome = rawUpdate.homeScore ?? match.homeScore ?? 0;
  const resolvedAway = rawUpdate.awayScore ?? match.awayScore ?? 0;
  const newGoals =
    effectiveStatus === 'live' ? findNewTimelineGoals(previousTimeline, timeline) : [];
  const goalUpdates =
    newGoals.length > 0
      ? [
          {
            match: {
              ...match,
              ...rawUpdate,
              status: effectiveStatus,
              homeScore: resolvedHome,
              awayScore: resolvedAway,
            },
            newGoals,
            homeScore: resolvedHome,
            awayScore: resolvedAway,
          },
        ]
      : [];

  return {
    events: matchUpdated ? 1 : 0,
    reports: reportsSynced,
    scoringIds,
    newlyFinishedIds,
    newlyLiveIds: becameLive ? [match._id] : [],
    goalUpdates,
    updated: matchUpdated,
  };
}

/** Refresca cronología FIFA de partidos en vivo con syncedAt vencido (loop kickoff watch). */
export async function syncStaleLiveFifaMatchEvents({
  maxAgeMs = LIVE_FIFA_EVENTS_MAX_AGE_MS,
  now = Date.now(),
} = {}) {
  const liveMatches = await Match.find({ status: 'live' }).lean();
  const staleMatches = liveMatches.filter((match) => isLiveFifaEventsStale(match, maxAgeMs, now));
  if (!staleMatches.length) {
    return {
      matches: 0,
      events: 0,
      reports: 0,
      scoringIds: [],
      newlyFinishedIds: [],
      newlyLiveIds: [],
      goalUpdates: [],
    };
  }

  let calendar = [];
  try {
    calendar = await getCachedAllCalendarMatches();
  } catch (err) {
    console.warn('FIFA calendar unavailable for live refresh:', err.message);
  }

  let eventsSynced = 0;
  let reportsSynced = 0;
  const scoringIds = [];
  const newlyFinishedIds = [];
  const newlyLiveIds = [];
  const goalUpdates = [];

  for (const match of staleMatches) {
    const { homeTeam, awayTeam } = await loadMatchTeams(match);
    if (!homeTeam || !awayTeam) continue;

    try {
      const fifaEntry =
        (calendar.length
          ? await resolveFifaMatchEntry(calendar, match, homeTeam, awayTeam)
          : null) ?? buildFifaEntryFromStoredMeta(match);

      const result = await syncSingleMatchFifaEvents(match, homeTeam, awayTeam, fifaEntry);
      eventsSynced += result.events;
      reportsSynced += result.reports;
      scoringIds.push(...result.scoringIds);
      newlyFinishedIds.push(...result.newlyFinishedIds);
      newlyLiveIds.push(...(result.newlyLiveIds ?? []));
      goalUpdates.push(...(result.goalUpdates ?? []));
    } catch (err) {
      console.warn(`FIFA live refresh skip match ${match.externalId}:`, err.message);
    }
  }

  return {
    matches: staleMatches.length,
    events: eventsSynced,
    reports: reportsSynced,
    scoringIds,
    newlyFinishedIds,
    newlyLiveIds,
    goalUpdates,
  };
}

export async function syncFifaMatchEvents({ extraMatchIds = [] } = {}) {
  const recentCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const now = new Date();
  const [liveMatches, recentFinishedMatches, kickoffPassedUpcoming] = await Promise.all([
    Match.find({ status: 'live' }).lean(),
    Match.find({ status: 'finished', kickoffAt: { $gte: recentCutoff } }).lean(),
    Match.find({
      status: 'upcoming',
      kickoffAt: { $lte: now, $ne: null },
    }).lean(),
  ]);

  const matchesToSync = [...liveMatches, ...kickoffPassedUpcoming];
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

  if (!matchesToSync.length) {
    return {
      matches: 0,
      events: 0,
      reports: 0,
      scoringIds: [],
      newlyFinishedIds: [],
      newlyLiveIds: [],
      goalUpdates: [],
    };
  }

  let calendar = [];
  try {
    calendar = await getCachedAllCalendarMatches();
  } catch (err) {
    console.warn('FIFA calendar sync skipped:', err.message);
    return {
      matches: 0,
      events: 0,
      reports: 0,
      scoringIds: [],
      newlyFinishedIds: [],
      newlyLiveIds: [],
      goalUpdates: [],
    };
  }

  let eventsSynced = 0;
  let reportsSynced = 0;
  const scoringIds = [];
  const newlyFinishedIds = [];
  const newlyLiveIds = [];
  const goalUpdates = [];

  for (const match of matchesToSync) {
    const { homeTeam, awayTeam } = await loadMatchTeams(match);
    if (!homeTeam || !awayTeam) continue;

    try {
      const fifaEntry = await resolveFifaMatchEntry(calendar, match, homeTeam, awayTeam);
      const result = await syncSingleMatchFifaEvents(match, homeTeam, awayTeam, fifaEntry);
      eventsSynced += result.events;
      reportsSynced += result.reports;
      scoringIds.push(...result.scoringIds);
      newlyFinishedIds.push(...result.newlyFinishedIds);
      newlyLiveIds.push(...(result.newlyLiveIds ?? []));
      goalUpdates.push(...(result.goalUpdates ?? []));
    } catch (err) {
      console.warn(`FIFA events sync skip match ${match.externalId}:`, err.message);
    }
  }

  return {
    matches: matchesToSync.length,
    events: eventsSynced,
    reports: reportsSynced,
    scoringIds,
    newlyFinishedIds,
    newlyLiveIds,
    goalUpdates,
  };
}
