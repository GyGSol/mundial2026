import { Match } from '../models/Match.js';
import { Stadium } from '../models/Stadium.js';
import { recalculateMatchScores, recalculateAllLiveMatches } from './matchScoringService.js';
import { notifyLeaderboardUpdated, notifyMatchesUpdated } from './websocketService.js';
import { notifyMatchesLiveStarted } from './pushNotificationService.js';
import { blocksKickoffPromotion } from './matchWeatherOpsRules.js';
import {
  applyWeatherOpsSuggestion,
} from './matchWeatherEnrichmentService.js';
import { assessVenueWeatherRisk, shouldSuggestPreKickoffDelay } from './weatherRiskService.js';
import { getVenueWeatherForStadium } from './weatherService.js';

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

  const promotedIds = [];
  const delayedIds = [];

  for (const match of due) {
    if (blocksKickoffPromotion(match.weatherOps)) {
      delayedIds.push(match._id);
      continue;
    }

    const stadium = stadiumMap[match.stadiumId];
    const nwsDelayed = await maybeApplyNwsPreKickoffDelay(match, stadium);
    if (nwsDelayed || blocksKickoffPromotion(match.weatherOps)) {
      delayedIds.push(match._id);
      continue;
    }

    if (!matchNotStartedOnField(match)) {
      // API ya indica juego en curso — promover
    }

    match.status = 'live';
    if (match.homeScore == null) match.homeScore = 0;
    if (match.awayScore == null) match.awayScore = 0;
    match.lastSyncedAt = new Date();
    await match.save();
    promotedIds.push(match._id);
    await recalculateMatchScores(match._id);
  }

  if (promotedIds.length || delayedIds.length) {
    notifyMatchesUpdated({
      reason: promotedIds.length ? 'kickoff_live' : 'weather_pre_kickoff_delay',
      matchIds: [...promotedIds, ...delayedIds].map((id) => id.toString()),
    });
  }
  if (promotedIds.length) {
    notifyLeaderboardUpdated({ reason: 'kickoff_live' });
    const promotedMatches = due.filter((m) =>
      promotedIds.some((id) => String(id) === String(m._id))
    );
    notifyMatchesLiveStarted(promotedMatches).catch((err) => {
      console.error('[push] notifyMatchesLiveStarted failed:', err.message);
    });
  }

  return promotedIds;
}

/** Mantiene puntos y ranking al día mientras hay partidos en vivo. */
export async function syncLiveMatchScoring() {
  const promoted = await promoteMatchesAtKickoff();
  const { matches, users } = await recalculateAllLiveMatches();

  if (matches > 0 && users > 0) {
    notifyMatchesUpdated({ reason: 'live_scoring_sync', liveMatches: matches });
  }

  return { promoted: promoted.length, liveMatches: matches, users };
}
