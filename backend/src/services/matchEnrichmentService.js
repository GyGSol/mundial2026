import { Team } from '../models/Team.js';
import { Player } from '../models/Player.js';
import { Stadium } from '../models/Stadium.js';
import { Prediction } from '../models/Prediction.js';
import {
  ensureDefaultPredictionsForUser,
  enrichMatchPredictionMeta,
} from './predictionLockService.js';
import {
  applyResolvedKnockoutToMatch,
  isOfficialKnockoutMatch,
} from './predictedMatchContextService.js';
import { getCachedUserPredictedMatchContext } from './userPredictedMatchContextCache.js';
import { enrichMatchPhaseFields } from './matchPhaseUtils.js';
import {
  enrichMatchLiveFields,
  createPriorTournamentGoalCountsResolver,
} from './matchLiveData.js';
import { getCachedFinishedMatchesForTournamentGoals } from './tournamentGoalsFinishedMatchesCache.js';
import { RECENTLY_FINISHED_GRACE_MS } from './matchDisplayVisibilityService.js';
import { ensureFifaShirtMaps } from './fifaShirtMapService.js';
import { formatStadiumForClient } from './stadiumPayload.js';
import { formatTeamForClient } from './teamPayload.js';
import { getFifaWorldRankings } from './aiTeamMatchContextService.js';
import { getBroadcastersForMatch } from '../data/broadcastSchedule.js';
import {
  attachWeatherAndScheduleToEnrichedMatches,
} from './matchWeatherEnrichmentService.js';
import { resolveDisplayKickoffAt, resolveScheduleKickoffAt } from './kickoffTimeService.js';
import { serializeWeatherOpsForClient } from './matchWeatherOpsRules.js';
import { mapPlayerToTimelineRosterEntry } from './playerPhotoService.js';

/**
 * @param {import('mongoose').LeanDocument[]} matches
 * @param {import('mongoose').Types.ObjectId | undefined} userId
 * @param {{
 *   includePlayers?: boolean,
 *   includeKnockoutContext?: boolean,
 *   ensureUserDefaults?: boolean,
 * }} options
 */
export async function enrichMatches(matches, userId, options = {}) {
  const {
    includePlayers = true,
    includeKnockoutContext = true,
    ensureUserDefaults = true,
  } = options;

  if (userId && ensureUserDefaults) {
    await ensureDefaultPredictionsForUser(userId);
  }

  const fifaRankings = await getFifaWorldRankings();

  const teamIds = new Set();
  for (const m of matches) {
    teamIds.add(m.homeTeamId);
    teamIds.add(m.awayTeamId);
  }

  const teams = await Team.find({ externalId: { $in: [...teamIds] } }).lean();
  const teamMap = Object.fromEntries(teams.map((t) => [t.externalId, t]));

  const needsTournamentGoals = matches.some(
    (m) => m.status === 'live' || m.status === 'finished'
  );

  let playersByTeamId = {};
  if (includePlayers || needsTournamentGoals) {
    const players = await Player.find({ teamExternalId: { $in: [...teamIds] } }).lean();
    for (const player of players) {
      if (!playersByTeamId[player.teamExternalId]) {
        playersByTeamId[player.teamExternalId] = [];
      }
      playersByTeamId[player.teamExternalId].push(mapPlayerToTimelineRosterEntry(player));
    }
  }

  const stadiumIds = [...new Set(matches.map((m) => m.stadiumId).filter(Boolean))];
  const stadiums = await Stadium.find({ externalId: { $in: stadiumIds } }).lean();
  const stadiumMap = Object.fromEntries(stadiums.map((s) => [s.externalId, s]));

  let predictionMap = {};
  if (userId) {
    const predictions = await Prediction.find({
      userId,
      matchId: { $in: matches.map((m) => m._id) },
    }).lean();
    predictionMap = Object.fromEntries(
      predictions.map((p) => [
        p.matchId.toString(),
        {
          homeGoals: p.homeGoals,
          awayGoals: p.awayGoals,
          userSubmitted: Boolean(p.userSubmitted),
          pointsEarned: p.pointsEarned,
          pointsBreakdown: p.pointsBreakdown,
          updatedAt: p.updatedAt,
        },
      ])
    );
  }

  let resolvedKnockoutByExternalId = null;
  if (userId && includeKnockoutContext && matches.some(isOfficialKnockoutMatch)) {
    const ctx = await getCachedUserPredictedMatchContext(userId);
    resolvedKnockoutByExternalId = ctx.resolvedKnockoutByExternalId;
  }

  const resolvePriorTournamentGoalCounts = needsTournamentGoals
    ? createPriorTournamentGoalCountsResolver(
        await getCachedFinishedMatchesForTournamentGoals()
      )
    : null;

  const enrichedBase = matches.map((m) => {
    const prediction = predictionMap[m._id.toString()] || null;
    const meta = enrichMatchPredictionMeta(m, prediction);

    const phaseFields = enrichMatchPhaseFields(m);
    const priorTournamentGoalCounts =
      resolvePriorTournamentGoalCounts && (m.status === 'live' || m.status === 'finished')
        ? resolvePriorTournamentGoalCounts(m.externalId, m.status)
        : undefined;
    const liveFields = enrichMatchLiveFields(m, {
      homePlayers: playersByTeamId[m.homeTeamId] ?? [],
      awayPlayers: playersByTeamId[m.awayTeamId] ?? [],
      priorTournamentGoalCounts,
    });

    const displayKickoff = resolveDisplayKickoffAt(m) ?? m.kickoffAt;
    const scheduleKickoff = resolveScheduleKickoffAt(m);

    const base = {
      id: m._id.toString(),
      externalId: m.externalId,
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      group: m.group,
      matchday: m.matchday,
      localDate: m.localDate,
      type: phaseFields.type,
      isKnockout: phaseFields.isKnockout,
      knockoutPhase: phaseFields.knockoutPhase,
      knockoutPhaseKey: phaseFields.knockoutPhaseKey,
      status: m.status,
      finishedAt: m.finishedAt?.toISOString?.() ?? null,
      kickoffAt: displayKickoff,
      scheduleKickoffAt: scheduleKickoff?.toISOString?.() ?? null,
      kickoffTimezone: m.kickoffTimezone || stadiumMap[m.stadiumId]?.timezone || null,
      lockAt: meta.lockAt,
      homeTeam: formatTeamForClient(teamMap[m.homeTeamId], fifaRankings),
      awayTeam: formatTeamForClient(teamMap[m.awayTeamId], fifaRankings),
      broadcasters: getBroadcastersForMatch(m.externalId, {
        homeTeam: teamMap[m.homeTeamId],
        awayTeam: teamMap[m.awayTeamId],
      }),
      stadium: formatStadiumForClient(stadiumMap[m.stadiumId]),
      weatherOps: serializeWeatherOpsForClient(m.weatherOps),
      prediction,
      ...liveFields,
      ...meta,
    };

    return applyResolvedKnockoutToMatch(
      base,
      resolvedKnockoutByExternalId?.get(String(m.externalId))
    );
  });

  return attachWeatherAndScheduleToEnrichedMatches(matches, enrichedBase, stadiumMap);
}

export async function enrichMatchesLight(matches, userId) {
  return enrichMatches(matches, userId, {
    includePlayers: false,
    includeKnockoutContext: false,
    ensureUserDefaults: false,
  });
}

export async function enrichMatchesFull(matches, userId) {
  return enrichMatches(matches, userId, {
    includePlayers: true,
    includeKnockoutContext: true,
    ensureUserDefaults: false,
  });
}

export async function enrichMatchesForPredictions(matches, userId) {
  return enrichMatches(matches, userId, {
    includePlayers: false,
    includeKnockoutContext: true,
    ensureUserDefaults: false,
  });
}

export async function prepareFifaShirtMapsForMatches(matches) {
  const now = Date.now();
  const needsShirts = matches.filter((match) => {
    if (match.status === 'live') return true;
    if (match.status !== 'finished' || !match.finishedAt) return false;
    const finishedMs = new Date(match.finishedAt).getTime();
    return Number.isFinite(finishedMs) && now - finishedMs <= RECENTLY_FINISHED_GRACE_MS;
  });
  if (needsShirts.length) {
    await ensureFifaShirtMaps(needsShirts);
  }
}
