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
import { enrichMatchLiveFields } from './matchLiveData.js';
import { ensureFifaShirtMaps } from './fifaShirtMapService.js';
import { formatStadiumForClient } from './stadiumPayload.js';
import { getBroadcastersForMatch } from '../data/broadcastSchedule.js';

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

  const teamIds = new Set();
  for (const m of matches) {
    teamIds.add(m.homeTeamId);
    teamIds.add(m.awayTeamId);
  }

  const teams = await Team.find({ externalId: { $in: [...teamIds] } }).lean();
  const teamMap = Object.fromEntries(teams.map((t) => [t.externalId, t]));

  let playersByTeamId = {};
  if (includePlayers) {
    const players = await Player.find({ teamExternalId: { $in: [...teamIds] } }).lean();
    for (const player of players) {
      if (!playersByTeamId[player.teamExternalId]) {
        playersByTeamId[player.teamExternalId] = [];
      }
      playersByTeamId[player.teamExternalId].push({
        fullName: player.fullName,
        position: player.position,
        shirtNumber: player.shirtNumber ?? null,
      });
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
        },
      ])
    );
  }

  let resolvedKnockoutByExternalId = null;
  if (userId && includeKnockoutContext && matches.some(isOfficialKnockoutMatch)) {
    const ctx = await getCachedUserPredictedMatchContext(userId);
    resolvedKnockoutByExternalId = ctx.resolvedKnockoutByExternalId;
  }

  return matches.map((m) => {
    const prediction = predictionMap[m._id.toString()] || null;
    const meta = enrichMatchPredictionMeta(m, prediction);

    const phaseFields = enrichMatchPhaseFields(m);
    const liveFields = enrichMatchLiveFields(m, {
      homePlayers: playersByTeamId[m.homeTeamId] ?? [],
      awayPlayers: playersByTeamId[m.awayTeamId] ?? [],
    });

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
      kickoffAt: m.kickoffAt,
      kickoffTimezone: m.kickoffTimezone || stadiumMap[m.stadiumId]?.timezone || null,
      lockAt: meta.lockAt,
      homeTeam: teamMap[m.homeTeamId]
        ? {
            nameEn: teamMap[m.homeTeamId].nameEn,
            fifaCode: teamMap[m.homeTeamId].fifaCode,
            flag: teamMap[m.homeTeamId].flag,
            externalId: teamMap[m.homeTeamId].externalId,
          }
        : null,
      awayTeam: teamMap[m.awayTeamId]
        ? {
            nameEn: teamMap[m.awayTeamId].nameEn,
            fifaCode: teamMap[m.awayTeamId].fifaCode,
            flag: teamMap[m.awayTeamId].flag,
            externalId: teamMap[m.awayTeamId].externalId,
          }
        : null,
      broadcasters: getBroadcastersForMatch(m.externalId, {
        homeTeam: teamMap[m.homeTeamId],
        awayTeam: teamMap[m.awayTeamId],
      }),
      stadium: formatStadiumForClient(stadiumMap[m.stadiumId]),
      prediction,
      ...liveFields,
      ...meta,
    };

    return applyResolvedKnockoutToMatch(
      base,
      resolvedKnockoutByExternalId?.get(String(m.externalId))
    );
  });
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
  const liveMatches = matches.filter((m) => m.status === 'live');
  if (liveMatches.length) {
    await ensureFifaShirtMaps(liveMatches);
  }
}
