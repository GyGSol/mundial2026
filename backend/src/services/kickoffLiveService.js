import { Match } from '../models/Match.js';
import { Stadium } from '../models/Stadium.js';
import { recalculateMatchScores, ensureLiveScoringBaselines, clearMatchScores } from './matchScoringService.js';
import { notifyLeaderboardUpdated, notifyMatchesUpdated } from './websocketService.js';
import { invalidateMatchRelatedCaches } from './matchRelatedCaches.js';
import { invalidateRankingFinishedMatchesCache } from './rankingFinishedMatchesCache.js';
import { invalidateTournamentGoalsFinishedMatchesCache } from './tournamentGoalsFinishedMatchesCache.js';
import { processGoalUpdates } from './goalPushService.js';
import { notifyLiveStartForMatchIds } from './liveStartPushService.js';
import { blocksKickoffPromotion, clearWeatherOpsToNormal, isPreKickoffDelayExpired, normalizeWeatherOps } from './matchWeatherOpsRules.js';
import {
  applyInPlayWeatherSuspension,
  applyWeatherOpsSuggestion,
  refreshInPlayWeatherSuspension,
} from './matchWeatherEnrichmentService.js';
import {
  assessVenueWeatherRisk,
  shouldClearContradictedInPlaySuspension,
  shouldClearInPlaySuspension,
  shouldSuggestPreKickoffDelay,
} from './weatherRiskService.js';
import { getVenueWeatherForStadium } from './weatherService.js';
import {
  fetchAllCalendarMatches,
  getCachedAllCalendarMatches,
  resolveFifaMatchEntry,
} from './fifaApiClient.js';
import { Team } from '../models/Team.js';
import { isPlausibleMatchGoalCount, latestClockFromTimeline, mergePlausibleGoalCounts, goalCountsFromTimeline } from './matchLiveData.js';
import { syncMicroEventsFromMatch } from './matchMicroEventService.js';
import {
  elapsedTokenIndicatesFinished,
  fifaEntryIndicatesFinished,
  isMatchClearlyInProgress,
  isMatchKickoffStale,
  matchEvidenceShowsInProgress,
  matchFifaTimelineIndicatesFinished,
  readElapsedToken,
  shouldFinalizeStaleLiveMatch,
  matchFinishedImplausibleByWallClock,
  resolveKickoffMs,
  wallClockAllowsMatchFinished,
} from './matchStatusRules.js';
import { knockoutTieBlocksMatchFinish } from './knockoutExtraTimeRules.js';
import { applyStatusTransitionFields, findRecentlyFinishedMatchesQuery } from './matchDisplayVisibilityService.js';

function matchEvidentlyStartedOnField(match) {
  const elapsed = match?.raw?.time_elapsed ?? match?.raw?.timeElapsed;
  const normalized = String(elapsed ?? '').toLowerCase();
  if (!normalized || normalized === 'notstarted' || normalized === '0') return false;
  return true;
}

function readFifaLiveScores(fifaEntry) {
  const homeScore = Number(fifaEntry?.HomeTeamScore ?? fifaEntry?.Home?.Score);
  const awayScore = Number(fifaEntry?.AwayTeamScore ?? fifaEntry?.Away?.Score);
  if (
    !Number.isFinite(homeScore) ||
    !Number.isFinite(awayScore) ||
    !isPlausibleMatchGoalCount(homeScore) ||
    !isPlausibleMatchGoalCount(awayScore)
  ) {
    return null;
  }
  if (homeScore === 0 && awayScore === 0) return null;
  return { homeScore, awayScore };
}

function matchEvidentlyStartedFromFifa(fifaEntry) {
  if (!fifaEntry) return false;
  const period = String(fifaEntry.Period ?? fifaEntry.MatchStatus ?? '').toLowerCase();
  if (period && !['0', 'notstarted', 'pre_match', 'prematch'].includes(period)) {
    return true;
  }
  return Boolean(readFifaLiveScores(fifaEntry));
}

async function loadFifaEntryForMatch(match, calendar, teamMap) {
  const homeTeam = teamMap.get(match.homeTeamId);
  const awayTeam = teamMap.get(match.awayTeamId);
  if (!homeTeam || !awayTeam) return null;
  return resolveFifaMatchEntry(calendar, match, homeTeam, awayTeam);
}

function shouldClearWeatherDelay(match, fifaEntry, now = Date.now()) {
  if (!blocksKickoffPromotion(match.weatherOps)) return false;
  if (isPreKickoffDelayExpired(match.weatherOps, now)) return true;
  if (matchEvidentlyStartedOnField(match)) return true;
  if (matchEvidentlyStartedFromFifa(fifaEntry)) return true;
  return false;
}

function matchNotStartedOnField(match) {
  const elapsed = match?.raw?.time_elapsed ?? match?.raw?.timeElapsed;
  return (
    !elapsed ||
    elapsed === 'notstarted' ||
    elapsed === '0' ||
    String(elapsed).toLowerCase() === '0'
  );
}

async function maybeApplyNwsPreKickoffDelay(match, stadium) {
  if (!stadium || match.status !== 'upcoming') return false;
  if (blocksKickoffPromotion(match.weatherOps)) return true;

  const weather = await getVenueWeatherForStadium(stadium, { kickoffAt: match.kickoffAt });
  const risk = await assessVenueWeatherRisk(stadium, {
    weather,
    kickoffAt: match.kickoffAt,
    urgent: true,
  });

  if (!shouldSuggestPreKickoffDelay(risk, match)) return false;

  const suggestion = applyWeatherOpsSuggestion(match, risk, stadium);
  if (!suggestion) return false;

  match.weatherOps = suggestion;
  match.lastSyncedAt = new Date();
  await match.save();
  return true;
}

function weatherOpsChanged(previous, next) {
  if (!next) return false;
  return (
    previous.phase !== next.phase ||
    previous.nwsAlertId !== next.nwsAlertId ||
    previous.lastAlertAt?.getTime?.() !== next.lastAlertAt?.getTime?.() ||
    previous.resumeEarliestAt?.getTime?.() !== next.resumeEarliestAt?.getTime?.()
  );
}

/** Escenario B — suspende partidos `live` cuando NOAA/MSC/Open-Meteo reportan riesgo `stop`. */
export async function syncLiveWeatherOps() {
  const liveMatches = await Match.find({ status: 'live' });
  if (!liveMatches.length) {
    return { suspended: [], cleared: [], refreshed: [] };
  }

  const stadiumIds = [...new Set(liveMatches.map((m) => m.stadiumId).filter(Boolean))];
  const stadiums = await Stadium.find({ externalId: { $in: stadiumIds } }).lean();
  const stadiumMap = Object.fromEntries(stadiums.map((s) => [s.externalId, s]));

  const suspendedIds = [];
  const clearedIds = [];
  const refreshedIds = [];

  for (const match of liveMatches) {
    const stadium = stadiumMap[match.stadiumId];
    if (!stadium) continue;

    const weather = await getVenueWeatherForStadium(stadium, { kickoffAt: match.kickoffAt });
    const risk = await assessVenueWeatherRisk(stadium, {
      weather,
      kickoffAt: match.kickoffAt,
      urgent: true,
    });

    const previousOps = normalizeWeatherOps(match.weatherOps);

    if (
      shouldClearInPlaySuspension(risk, match) ||
      shouldClearContradictedInPlaySuspension(match, risk, stadium)
    ) {
      match.weatherOps = clearWeatherOpsToNormal();
      match.lastSyncedAt = new Date();
      await match.save();
      clearedIds.push(match._id);
      continue;
    }

    const refresh = refreshInPlayWeatherSuspension(match, risk, stadium);
    if (refresh && weatherOpsChanged(previousOps, refresh)) {
      match.weatherOps = refresh;
      match.lastSyncedAt = new Date();
      await match.save();
      refreshedIds.push(match._id);
      continue;
    }

    const suggestion = applyInPlayWeatherSuspension(match, risk, stadium);
    if (!suggestion) continue;

    match.weatherOps = suggestion;
    match.lastSyncedAt = new Date();
    await match.save();
    suspendedIds.push(match._id);
  }

  const changedIds = [...suspendedIds, ...clearedIds, ...refreshedIds];
  if (changedIds.length) {
    notifyMatchesUpdated({
      reason: suspendedIds.length
        ? 'weather_in_play_suspended'
        : clearedIds.length
          ? 'weather_in_play_resumed'
          : 'weather_in_play_updated',
      matchIds: changedIds.map((id) => id.toString()),
    });
    invalidateMatchRelatedCaches();
  }

  return { suspended: suspendedIds, cleared: clearedIds, refreshed: refreshedIds };
}

/** Pasa a live los upcoming cuyo kickoff ya empezó (si el sync externo aún no lo hizo). */
export async function promoteMatchesAtKickoff() {
  const now = new Date();
  const due = await Match.find({
    status: 'upcoming',
    kickoffAt: { $lte: now, $ne: null },
  });

  if (!due.length) return [];

  const stadiumIds = [...new Set(due.map((m) => m.stadiumId).filter(Boolean))];
  const stadiums = await Stadium.find({ externalId: { $in: stadiumIds } }).lean();
  const stadiumMap = Object.fromEntries(stadiums.map((s) => [s.externalId, s]));

  const teamIds = [
    ...new Set(due.flatMap((match) => [match.homeTeamId, match.awayTeamId]).filter(Boolean)),
  ];
  const teams = await Team.find({ externalId: { $in: teamIds } }).select('externalId fifaCode nameEn').lean();
  const teamMap = new Map(teams.map((team) => [team.externalId, team]));

  let fifaCalendar = [];
  try {
    fifaCalendar = await getCachedAllCalendarMatches();
  } catch (err) {
    console.warn('FIFA calendar unavailable for kickoff promotion:', err.message);
  }

  const promotedIds = [];
  const delayedIds = [];

  for (const match of due) {
    const fifaEntry = await loadFifaEntryForMatch(match, fifaCalendar, teamMap);
    let clearedWeatherDelay = false;

    if (blocksKickoffPromotion(match.weatherOps)) {
      if (shouldClearWeatherDelay(match, fifaEntry, now.getTime())) {
        match.weatherOps = clearWeatherOpsToNormal();
        clearedWeatherDelay = true;
      } else {
        delayedIds.push(match._id);
        continue;
      }
    }

    const evidentlyStarted =
      clearedWeatherDelay ||
      matchEvidentlyStartedOnField(match) ||
      matchEvidentlyStartedFromFifa(fifaEntry);

    const stadium = stadiumMap[match.stadiumId];
    if (!evidentlyStarted) {
      const nwsDelayed = await maybeApplyNwsPreKickoffDelay(match, stadium);
      if (nwsDelayed || blocksKickoffPromotion(match.weatherOps)) {
        delayedIds.push(match._id);
        continue;
      }
    }

    if (!matchNotStartedOnField(match)) {
      // API ya indica juego en curso — promover
    }

    const fifaScores = readFifaLiveScores(fifaEntry);
    const promotionUpdate = {
      status: 'live',
      lastSyncedAt: new Date(),
      homeScore: fifaScores?.homeScore ?? (match.homeScore == null ? 0 : match.homeScore),
      awayScore: fifaScores?.awayScore ?? (match.awayScore == null ? 0 : match.awayScore),
    };
    if (clearedWeatherDelay) {
      promotionUpdate.weatherOps = clearWeatherOpsToNormal();
    }

    const claimed = await Match.findOneAndUpdate(
      { _id: match._id, status: 'upcoming' },
      { $set: promotionUpdate },
      { new: true }
    );
    if (!claimed) continue;

    promotedIds.push(claimed._id);
    await recalculateMatchScores(claimed._id);
  }

  if (promotedIds.length || delayedIds.length) {
    notifyMatchesUpdated({
      reason: promotedIds.length ? 'kickoff_live' : 'weather_pre_kickoff_delay',
      matchIds: [...promotedIds, ...delayedIds].map((id) => id.toString()),
    });
  }
  if (promotedIds.length) {
    invalidateMatchRelatedCaches();
    notifyLeaderboardUpdated({ reason: 'kickoff_live' });

    notifyLiveStartForMatchIds(promotedIds).catch((err) => {
      console.error('[push] notifyLiveStartForMatchIds failed:', err.message);
    });
  }

  return promotedIds;
}

/** Ventana de kickoff para buscar cierres prematuros (KO con alargue + penales puede superar 120'). */
export const REOPEN_FINISHED_KICKOFF_LOOKBACK_MS = 180 * 60 * 1000;

/** Reabre partidos marcados `finished` con evidencia de juego en curso (cierre prematuro). */
export async function reopenPrematurelyFinishedMatches(now = Date.now()) {
  const recentKickoffCutoff = new Date(now - REOPEN_FINISHED_KICKOFF_LOOKBACK_MS);
  const candidates = await Match.find({
    status: 'finished',
    kickoffAt: { $gte: recentKickoffCutoff },
  }).lean();

  if (!candidates.length) return [];

  let fifaCalendar = [];
  try {
    fifaCalendar = await getCachedAllCalendarMatches();
  } catch (err) {
    console.warn('FIFA calendar unavailable for premature finish reopen:', err.message);
  }

  const teamIds = [
    ...new Set(candidates.flatMap((match) => [match.homeTeamId, match.awayTeamId]).filter(Boolean)),
  ];
  const teams = await Team.find({ externalId: { $in: teamIds } })
    .select('externalId fifaCode nameEn')
    .lean();
  const teamMap = new Map(teams.map((team) => [team.externalId, team]));

  const reopenedIds = [];

  for (const match of candidates) {
    const fifaEntry = fifaCalendar.length
      ? await loadFifaEntryForMatch(match, fifaCalendar, teamMap)
      : null;
    const knockoutStillPlaying = knockoutTieBlocksMatchFinish(match, fifaEntry);

    if (isMatchKickoffStale(match.kickoffAt, now) && !knockoutStillPlaying) continue;

    if (
      matchFifaTimelineIndicatesFinished(match) &&
      wallClockAllowsMatchFinished(match, now) &&
      !knockoutStillPlaying
    ) {
      continue;
    }
    const fifaContradictsFinish = Boolean(
      fifaEntry && !fifaEntryIndicatesFinished(fifaEntry, match)
    );

    const implausibleFinish = matchFinishedImplausibleByWallClock(match, now);
    const inProgress = !implausibleFinish && matchEvidenceShowsInProgress(match);
    const knockoutExtraTime = knockoutTieBlocksMatchFinish(match, fifaEntry);
    if (!implausibleFinish && !inProgress && !fifaContradictsFinish && !knockoutExtraTime) continue;

    const timeline = match.raw?.fifaEvents?.timeline;
    const clock =
      Array.isArray(timeline) && timeline.length ? latestClockFromTimeline(timeline) : null;
    const badElapsed = elapsedTokenIndicatesFinished(readElapsedToken(match));
    const badFinished =
      match.raw?.finished === 'TRUE' ||
      match.raw?.finished === true ||
      match.raw?.finished === 'true';
    const stripMatchEnd = implausibleFinish || fifaContradictsFinish || knockoutExtraTime;

    const kickoffMs = resolveKickoffMs(match);
    const nextStatus =
      kickoffMs != null && kickoffMs > now ? 'upcoming' : 'live';

    const update = {
      status: nextStatus,
      lastSyncedAt: new Date(),
    };
    applyStatusTransitionFields(update, {
      previousStatus: 'finished',
      nextStatus,
      existingFinishedAt: match.finishedAt ?? null,
    });
    if (badFinished || stripMatchEnd) update['raw.finished'] = 'FALSE';
    if (badElapsed || stripMatchEnd) {
      const timelineForClock =
        stripMatchEnd && Array.isArray(timeline)
          ? timeline.filter((event) => event?.type !== 'match_end')
          : timeline;
      const correctedClock =
        Array.isArray(timelineForClock) && timelineForClock.length
          ? latestClockFromTimeline(timelineForClock)
          : clock;
      update['raw.time_elapsed'] = correctedClock
        ? String(correctedClock).replace(/'+$/, '')
        : 'live';
    }
    if (stripMatchEnd && Array.isArray(timeline)) {
      update['raw.fifaEvents.timeline'] = timeline.filter((event) => event?.type !== 'match_end');
    }
    if (nextStatus === 'live' && !match.liveStartedPushSentAt) {
      update.liveStartedPushSentAt = new Date();
    }

    const updated = await Match.findOneAndUpdate(
      { _id: match._id, status: 'finished' },
      { $set: update },
      { new: true }
    );
    if (!updated) continue;

    reopenedIds.push(updated._id);
    await clearMatchScores(updated._id);
    await recalculateMatchScores(updated._id);
  }

  if (reopenedIds.length) {
    invalidateRankingFinishedMatchesCache();
    invalidateTournamentGoalsFinishedMatchesCache();
    invalidateMatchRelatedCaches();
    notifyMatchesUpdated({
      reason: 'premature_finish_reopened',
      matchIds: reopenedIds.map((id) => id.toString()),
    });
    notifyLeaderboardUpdated({ reason: 'premature_finish_reopened' });
    console.log(`Premature finish reopen: ${reopenedIds.length} partido(s) volvieron a live`);
  }

  return reopenedIds;
}

/** Cierra partidos que quedaron en `live` cuando worldcup26/FIFA no actualizaron el estado. */
export async function finalizeStaleLiveMatches(now = Date.now()) {
  const liveMatches = await Match.find({ status: 'live' }).lean();
  if (!liveMatches.length) return [];

  let fifaCalendar = [];
  try {
    fifaCalendar = await getCachedAllCalendarMatches();
  } catch (err) {
    console.warn('FIFA calendar unavailable for stale live finalize:', err.message);
  }

  const teamIds = [
    ...new Set(liveMatches.flatMap((match) => [match.homeTeamId, match.awayTeamId]).filter(Boolean)),
  ];
  const teams = await Team.find({ externalId: { $in: teamIds } })
    .select('externalId fifaCode nameEn')
    .lean();
  const teamMap = new Map(teams.map((team) => [team.externalId, team]));

  const finalizedIds = [];

  for (const match of liveMatches) {
    const fifaEntry = fifaCalendar.length
      ? await loadFifaEntryForMatch(match, fifaCalendar, teamMap)
      : null;

    let shouldFinalize = shouldFinalizeStaleLiveMatch(match, now);

    if (!shouldFinalize && fifaEntry) {
      if (fifaEntryIndicatesFinished(fifaEntry, match) && !isMatchClearlyInProgress(match)) {
        shouldFinalize = true;
      }
    }

    if (!shouldFinalize) continue;

    const finalizeUpdate = {
      status: 'finished',
      lastSyncedAt: new Date(),
      'raw.time_elapsed': 'finished',
      'raw.finished': 'TRUE',
    };

    const fifaScores = readFifaLiveScores(fifaEntry);
    if (fifaScores) {
      finalizeUpdate.homeScore = mergePlausibleGoalCounts(match.homeScore, fifaScores.homeScore);
      finalizeUpdate.awayScore = mergePlausibleGoalCounts(match.awayScore, fifaScores.awayScore);
      finalizeUpdate['raw.fifaMeta.homeScore'] = finalizeUpdate.homeScore;
      finalizeUpdate['raw.fifaMeta.awayScore'] = finalizeUpdate.awayScore;
      finalizeUpdate['raw.fifaMeta.syncedAt'] = new Date().toISOString();
    } else {
      const { home, away } = goalCountsFromTimeline(match.raw?.fifaEvents?.timeline ?? []);
      finalizeUpdate.homeScore = mergePlausibleGoalCounts(match.homeScore, home);
      finalizeUpdate.awayScore = mergePlausibleGoalCounts(match.awayScore, away);
    }

    applyStatusTransitionFields(finalizeUpdate, {
      previousStatus: 'live',
      nextStatus: 'finished',
      existingFinishedAt: match.finishedAt ?? null,
    });

    const updated = await Match.findOneAndUpdate(
      { _id: match._id, status: 'live' },
      {
        $set: finalizeUpdate,
      },
      { new: true }
    );
    if (!updated) continue;

    finalizedIds.push(updated._id);
    await recalculateMatchScores(updated._id);
  }

  if (finalizedIds.length) {
    invalidateRankingFinishedMatchesCache();
    invalidateTournamentGoalsFinishedMatchesCache();
    invalidateMatchRelatedCaches();
    notifyMatchesUpdated({
      reason: 'stale_live_finalized',
      matchIds: finalizedIds.map((id) => id.toString()),
    });
    notifyLeaderboardUpdated({ reason: 'stale_live_finalized' });
    console.log(`Stale live finalize: ${finalizedIds.length} partido(s) pasaron a finalizado`);
    try {
      const { syncFifaMatchEvents } = await import('./fifaEventSyncService.js');
      await syncFifaMatchEvents({ extraMatchIds: finalizedIds });
    } catch (err) {
      console.warn('FIFA refresh after stale finalize skipped:', err.message);
    }

    try {
      const { scheduleBackupsForFinishedMatches } = await import('./matchFinishBackupService.js');
      scheduleBackupsForFinishedMatches(finalizedIds);
    } catch (err) {
      console.warn('Match finish backup skipped:', err.message);
    }
  }

  return finalizedIds;
}

/** Refresca timeline y marcador FIFA de partidos recién finalizados (p. ej. 4-1 tras cerrar en 3-0). */
export async function refreshRecentlyFinishedFifaEvents(now = Date.now()) {
  const recent = await Match.find(findRecentlyFinishedMatchesQuery(now)).select('_id').lean();
  if (!recent.length) return { events: 0, scoring: 0 };

  const { syncFifaMatchEvents } = await import('./fifaEventSyncService.js');
  const result = await syncFifaMatchEvents({ extraMatchIds: recent.map((m) => m._id) });

  let scoring = 0;
  for (const matchId of result.scoringIds ?? []) {
    await recalculateMatchScores(matchId);
    scoring += 1;
  }

  if ((result.events ?? 0) > 0 || scoring > 0) {
    invalidateMatchRelatedCaches();
    notifyMatchesUpdated({ reason: 'recent_finished_fifa_refresh' });
    notifyLeaderboardUpdated({ reason: 'recent_finished_fifa_refresh' });
  }

  return { events: result.events ?? 0, scoring };
}

/** Mantiene puntos y ranking al día mientras hay partidos en vivo. */
export async function syncLiveMatchScoring() {
  const reopened = await reopenPrematurelyFinishedMatches();
  const finalized = await finalizeStaleLiveMatches();
  const { syncStaleLiveFifaMatchEvents } = await import('./fifaEventSyncService.js');
  const liveFifaRefresh = await syncStaleLiveFifaMatchEvents();
  const fifaRefresh = await refreshRecentlyFinishedFifaEvents();
  const promoted = await promoteMatchesAtKickoff();
  const weatherOpsSync = await syncLiveWeatherOps();

  let scoringUsers = 0;
  for (const matchId of liveFifaRefresh.scoringIds ?? []) {
    const handledByGoalPush = (liveFifaRefresh.goalUpdates ?? []).some(
      (update) => String(update.match?._id) === String(matchId)
    );
    if (!handledByGoalPush) {
      const { users } = await recalculateMatchScores(matchId);
      scoringUsers += users;
    }
  }

  const baselineSync = await ensureLiveScoringBaselines();
  scoringUsers += baselineSync.users;

  if (liveFifaRefresh.goalUpdates?.length) {
    processGoalUpdates(liveFifaRefresh.goalUpdates).catch((err) => {
      console.error('[push] processGoalUpdates failed:', err.message);
    });
  }

  const liveStartIds = [
    ...(liveFifaRefresh.newlyLiveIds ?? []),
  ];
  if (liveStartIds.length) {
    notifyLiveStartForMatchIds(liveStartIds).catch((err) => {
      console.error('[push] notifyLiveStartForMatchIds (fifa) failed:', err.message);
    });
  }

  if (liveFifaRefresh.newlyFinishedIds?.length) {
    invalidateRankingFinishedMatchesCache();
    invalidateTournamentGoalsFinishedMatchesCache();
    notifyLeaderboardUpdated({ reason: 'live_fifa_finished' });
    try {
      const { scheduleBackupsForFinishedMatches } = await import('./matchFinishBackupService.js');
      scheduleBackupsForFinishedMatches(liveFifaRefresh.newlyFinishedIds);
    } catch (err) {
      console.warn('Match finish backup skipped:', err.message);
    }
  }

  const liveMatches = await Match.find({ status: 'live' }).select('_id homeScore awayScore').lean();
  const liveMatchCount = liveMatches.length;

  if (liveMatchCount > 0) {
    const { predictLiveAdjustment } = await import('./predictiveModelingService.js');
    for (const liveMatch of liveMatches) {
      void predictLiveAdjustment(liveMatch._id, {
        homeScore: liveMatch.homeScore,
        awayScore: liveMatch.awayScore,
      }).catch((err) => {
        console.warn(`Oracle live adjust (${liveMatch._id}):`, err.message);
      });
      void syncMicroEventsFromMatch(liveMatch).catch(() => null);
    }
  }

  const shouldInvalidateCaches =
    scoringUsers > 0 ||
    baselineSync.matches > 0 ||
    (liveFifaRefresh.events ?? 0) > 0 ||
    (liveFifaRefresh.goalUpdates?.length ?? 0) > 0 ||
    finalized.length > 0 ||
    reopened.length > 0 ||
    promoted.length > 0 ||
    weatherOpsSync.suspended.length > 0 ||
    weatherOpsSync.cleared.length > 0 ||
    weatherOpsSync.refreshed.length > 0 ||
    (fifaRefresh.events ?? 0) > 0 ||
    (fifaRefresh.scoring ?? 0) > 0;

  if (shouldInvalidateCaches) {
    invalidateMatchRelatedCaches();
    notifyMatchesUpdated({
      reason: 'live_scoring_sync',
      liveMatches: liveMatchCount,
      fifaEventsRefreshed: liveFifaRefresh.events,
    });
  }

  return {
    reopened: reopened.length,
    finalized: finalized.length,
    liveFifaRefresh,
    fifaRefresh,
    promoted: promoted.length,
    weatherOpsSync,
    liveMatches: liveMatchCount,
    users: scoringUsers,
  };
}
