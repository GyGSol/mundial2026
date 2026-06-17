import { Match } from '../models/Match.js';
import { Stadium } from '../models/Stadium.js';
import { recalculateMatchScores, recalculateAllLiveMatches } from './matchScoringService.js';
import { notifyLeaderboardUpdated, notifyMatchesUpdated } from './websocketService.js';
import { notifyMatchesLiveStarted } from './pushNotificationService.js';
import { blocksKickoffPromotion, clearWeatherOpsToNormal, isPreKickoffDelayExpired } from './matchWeatherOpsRules.js';
import {
  applyWeatherOpsSuggestion,
} from './matchWeatherEnrichmentService.js';
import { assessVenueWeatherRisk, shouldSuggestPreKickoffDelay } from './weatherRiskService.js';
import { getVenueWeatherForStadium } from './weatherService.js';
import {
  fetchAllCalendarMatches,
  resolveFifaMatchEntry,
} from './fifaApiClient.js';
import { Team } from '../models/Team.js';
import { isPlausibleMatchGoalCount } from './matchLiveData.js';
import { syncMicroEventsFromMatch } from './matchMicroEventService.js';
import {
  fifaEntryIndicatesFinished,
  shouldFinalizeStaleLiveMatch,
} from './matchStatusRules.js';

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
    fifaCalendar = await fetchAllCalendarMatches();
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
    notifyLeaderboardUpdated({ reason: 'kickoff_live' });

    const matchesToNotify = [];
    for (const matchId of promotedIds) {
      const claimedForPush = await Match.findOneAndUpdate(
        { _id: matchId, liveStartedPushSentAt: { $exists: false } },
        { liveStartedPushSentAt: new Date() },
        { new: true }
      );
      if (claimedForPush) matchesToNotify.push(claimedForPush);
    }

    if (matchesToNotify.length) {
      notifyMatchesLiveStarted(matchesToNotify).catch((err) => {
        console.error('[push] notifyMatchesLiveStarted failed:', err.message);
      });
    }
  }

  return promotedIds;
}

/** Cierra partidos que quedaron en `live` cuando worldcup26/FIFA no actualizaron el estado. */
export async function finalizeStaleLiveMatches(now = Date.now()) {
  const liveMatches = await Match.find({ status: 'live' }).lean();
  if (!liveMatches.length) return [];

  let fifaCalendar = [];
  try {
    fifaCalendar = await fetchAllCalendarMatches();
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
    let shouldFinalize = shouldFinalizeStaleLiveMatch(match, now);

    if (!shouldFinalize && fifaCalendar.length) {
      const fifaEntry = await loadFifaEntryForMatch(match, fifaCalendar, teamMap);
      if (fifaEntryIndicatesFinished(fifaEntry)) {
        shouldFinalize = true;
      }
    }

    if (!shouldFinalize) continue;

    const updated = await Match.findOneAndUpdate(
      { _id: match._id, status: 'live' },
      {
        $set: {
          status: 'finished',
          lastSyncedAt: new Date(),
          'raw.time_elapsed': 'finished',
          'raw.finished': 'TRUE',
        },
      },
      { new: true }
    );
    if (!updated) continue;

    finalizedIds.push(updated._id);
    await recalculateMatchScores(updated._id);
  }

  if (finalizedIds.length) {
    notifyMatchesUpdated({
      reason: 'stale_live_finalized',
      matchIds: finalizedIds.map((id) => id.toString()),
    });
    notifyLeaderboardUpdated({ reason: 'stale_live_finalized' });
    console.log(`Stale live finalize: ${finalizedIds.length} partido(s) pasaron a finalizado`);
  }

  return finalizedIds;
}

/** Mantiene puntos y ranking al día mientras hay partidos en vivo. */
export async function syncLiveMatchScoring() {
  const finalized = await finalizeStaleLiveMatches();
  const promoted = await promoteMatchesAtKickoff();
  const { matches, users } = await recalculateAllLiveMatches();

  if (matches > 0) {
    const liveMatches = await Match.find({ status: 'live' }).select('_id homeScore awayScore raw').lean();
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

  if (matches > 0 && users > 0) {
    notifyMatchesUpdated({ reason: 'live_scoring_sync', liveMatches: matches });
  }

  return { finalized: finalized.length, promoted: promoted.length, liveMatches: matches, users };
}
