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
  createPriorTournamentGoalCountsResolverFromBundle,
} from './matchLiveData.js';
import { getCachedTournamentGoalCountsBundle } from './tournamentGoalsFinishedMatchesCache.js';
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
import { unifyRawTeamPlayers } from './playerRosterUnifyService.js';
import { buildMatchLineupPayload } from './matchLineupService.js';
import {
  resolveFieldMatchScores,
  resolvePenaltyShootoutFromMatch,
} from '../../../shared/matchDisplayScore.js';

function resolveDisplayScoresForEnrichedMatch(match, liveFields = {}) {
  if (match.status !== 'live' && match.status !== 'finished') {
    return {
      homeScore: match.homeScore ?? 0,
      awayScore: match.awayScore ?? 0,
      penaltyShootout: liveFields.penaltyShootout ?? null,
    };
  }

  const penaltyShootout =
    liveFields.penaltyShootout ??
    resolvePenaltyShootoutFromMatch({
      homeScore: liveFields.homeScore ?? match.homeScore,
      awayScore: liveFields.awayScore ?? match.awayScore,
      raw: match.raw,
    });

  const fieldScores = resolveFieldMatchScores({
    homeScore: liveFields.homeScore ?? match.homeScore,
    awayScore: liveFields.awayScore ?? match.awayScore,
    raw: match.raw,
    penaltyShootout,
  });

  return {
    homeScore: fieldScores.homeScore,
    awayScore: fieldScores.awayScore,
    penaltyShootout,
  };
}

/**
 * @param {import('mongoose').LeanDocument[]} matches
 * @param {import('mongoose').Types.ObjectId | undefined} userId
 * @param {{
 *   includePlayers?: boolean,
 *   includeKnockoutContext?: boolean,
 *   ensureUserDefaults?: boolean,
 *   includeWeather?: boolean,
 *   includeLiveFields?: boolean,
 *   includeTimelineTournamentGoals?: boolean,
 *   includeLineup?: boolean,
 *   includeFullTimeline?: boolean,
 *   fetchExternalShirtNumbers?: boolean,
 * }} options
 */
export async function enrichMatches(matches, userId, options = {}) {
  const {
    includePlayers = true,
    includeKnockoutContext = true,
    ensureUserDefaults = true,
    includeWeather = true,
    includeLiveFields = true,
    includeTimelineTournamentGoals = includeLiveFields,
    includeLineup = false,
    includeFullTimeline = true,
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

  const hasLiveOrFinished = matches.some(
    (m) => m.status === 'live' || m.status === 'finished'
  );

  const needsTournamentGoals =
    includeTimelineTournamentGoals && includeLiveFields && hasLiveOrFinished;

  /** Fotos de cronología/cambios requieren plantel aunque no calculemos goles del torneo. */
  const needsLiveRosterForEnrichment =
    includeLiveFields && includeFullTimeline && !includePlayers && hasLiveOrFinished;

  let playersByTeamId = {};
  if (includePlayers || needsTournamentGoals || needsLiveRosterForEnrichment) {
    const rosterTeamIds = includePlayers
      ? [...teamIds]
      : [
          ...new Set(
            matches
              .filter((m) => m.status === 'live' || m.status === 'finished')
              .flatMap((m) => [m.homeTeamId, m.awayTeamId])
          ),
        ];
    const players = await Player.find({ teamExternalId: { $in: rosterTeamIds } }).lean();
    const rawPlayersByTeamId = {};
    for (const player of players) {
      if (!rawPlayersByTeamId[player.teamExternalId]) {
        rawPlayersByTeamId[player.teamExternalId] = [];
      }
      rawPlayersByTeamId[player.teamExternalId].push(player);
    }
    for (const [teamId, teamPlayers] of Object.entries(rawPlayersByTeamId)) {
      playersByTeamId[teamId] = unifyRawTeamPlayers(teamPlayers);
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
    ? createPriorTournamentGoalCountsResolverFromBundle(
        await getCachedTournamentGoalCountsBundle()
      )
    : null;

  const enrichedBase = await Promise.all(
    matches.map(async (m) => {
    const prediction = predictionMap[m._id.toString()] || null;
    const meta = enrichMatchPredictionMeta(m, prediction);

    const phaseFields = enrichMatchPhaseFields(m);
    const priorTournamentGoalCounts =
      resolvePriorTournamentGoalCounts && (m.status === 'live' || m.status === 'finished')
        ? resolvePriorTournamentGoalCounts(m.externalId, m.status)
        : undefined;
    const liveFields = includeLiveFields
      ? enrichMatchLiveFields(m, {
          homePlayers: playersByTeamId[m.homeTeamId] ?? [],
          awayPlayers: playersByTeamId[m.awayTeamId] ?? [],
          priorTournamentGoalCounts,
          includeFullTimeline,
        })
      : {};

    const displayKickoff = resolveDisplayKickoffAt(m) ?? m.kickoffAt;
    const scheduleKickoff = resolveScheduleKickoffAt(m);
    const displayScores = resolveDisplayScoresForEnrichedMatch(m, liveFields);

    const base = {
      id: m._id.toString(),
      externalId: m.externalId,
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
      homeScore: displayScores.homeScore,
      awayScore: displayScores.awayScore,
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
      homeScore: displayScores.homeScore,
      awayScore: displayScores.awayScore,
      ...(displayScores.penaltyShootout ? { penaltyShootout: displayScores.penaltyShootout } : {}),
    };

    const enriched = applyResolvedKnockoutToMatch(
      base,
      resolvedKnockoutByExternalId?.get(String(m.externalId))
    );

    if (includeLineup) {
      enriched.lineup = await buildMatchLineupPayload(m, {
        fetchExternalShirts: options.fetchExternalShirtNumbers !== false,
      });
    }

    return enriched;
  })
  );

  return attachWeatherAndScheduleToEnrichedMatches(matches, enrichedBase, stadiumMap, {
    includeWeather,
  });
}

export async function enrichMatchesLight(matches, userId) {
  return enrichMatches(matches, userId, {
    includePlayers: false,
    includeKnockoutContext: false,
    ensureUserDefaults: false,
  });
}

/** Ranking dashboard: timeline completo en live/recién finalizado. */
export async function enrichMatchesForRankingDashboard(matches, userId) {
  const hasLive = matches.some((m) => m.status === 'live');
  return enrichMatches(matches, userId, {
    includePlayers: false,
    includeKnockoutContext: false,
    ensureUserDefaults: false,
    includeWeather: hasLive,
    includeLiveFields: true,
    includeTimelineTournamentGoals: true,
    includeFullTimeline: true,
  });
}

/** Barra en vivo colapsada: marcador y listas derivadas sin cronología ni reporte FIFA. */
export async function enrichMatchesForLiveBarSummary(matches, userId) {
  const hasLive = matches.some((m) => m.status === 'live');
  return enrichMatches(matches, userId, {
    includePlayers: false,
    includeKnockoutContext: false,
    ensureUserDefaults: false,
    includeWeather: hasLive,
    includeLiveFields: true,
    includeTimelineTournamentGoals: false,
    includeFullTimeline: false,
  });
}

/** Próximos partidos en ranking: metadata + alineación probable/confirmada. */
export async function enrichMatchesForRankingUpcoming(matches, userId) {
  return enrichMatches(matches, userId, {
    includePlayers: false,
    includeKnockoutContext: false,
    ensureUserDefaults: false,
    includeWeather: false,
    includeLiveFields: false,
    includeTimelineTournamentGoals: false,
    includeLineup: true,
    fetchExternalShirtNumbers: false,
  });
}

/** Detalle GET /matches/:id — alineación confirmada o probable + timeline en vivo/finalizado. */
export async function enrichMatchesForMatchDetail(matches, userId) {
  const onlyUpcoming = matches.length > 0 && matches.every((m) => m.status === 'upcoming');
  if (onlyUpcoming) {
    return enrichMatchesForRankingUpcoming(matches, userId);
  }
  const hasLive = matches.some((m) => m.status === 'live');
  return enrichMatches(matches, userId, {
    includePlayers: false,
    includeKnockoutContext: false,
    ensureUserDefaults: false,
    includeWeather: hasLive,
    includeLiveFields: true,
    includeTimelineTournamentGoals: true,
    includeFullTimeline: true,
    includeLineup: true,
  });
}

/** Archivo colapsable: timeline básico sin goles torneo ni roster. */
export async function enrichMatchesForRankingArchive(matches, userId) {
  return enrichMatches(matches, userId, {
    includePlayers: false,
    includeKnockoutContext: false,
    ensureUserDefaults: false,
    includeWeather: false,
    includeLiveFields: true,
    includeTimelineTournamentGoals: false,
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

const PREDICTIONS_LIST_LIGHT_OPTS = {
  includePlayers: false,
  includeKnockoutContext: true,
  ensureUserDefaults: false,
  includeWeather: false,
  includeLiveFields: false,
};

const PREDICTIONS_LIST_LIVE_OPTS = {
  ...PREDICTIONS_LIST_LIGHT_OPTS,
  includeLiveFields: true,
  includeTimelineTournamentGoals: true,
};

/**
 * /predicciones: knockout + predicción en toda la lista; timeline/roster solo en
 * partidos en vivo o destacados en la barra (evita ~1s de roster en 100+ partidos).
 *
 * @param {import('mongoose').LeanDocument[]} matches
 * @param {import('mongoose').Types.ObjectId | undefined} userId
 * @param {{ liveBarMatchIds?: Set<string> | string[] }} [options]
 */
export async function enrichMatchesForPredictionsList(
  matches,
  userId,
  { liveBarMatchIds = new Set() } = {}
) {
  const liveBarIdSet =
    liveBarMatchIds instanceof Set ? liveBarMatchIds : new Set(liveBarMatchIds);
  const needsLiveEnrichment = (match) =>
    match.status === 'live' || liveBarIdSet.has(match._id.toString());

  const lightBatch = [];
  const liveBatch = [];
  for (const match of matches) {
    (needsLiveEnrichment(match) ? liveBatch : lightBatch).push(match);
  }

  const [lightEnriched, liveEnriched] = await Promise.all([
    lightBatch.length
      ? enrichMatches(lightBatch, userId, PREDICTIONS_LIST_LIGHT_OPTS)
      : [],
    liveBatch.length
      ? enrichMatches(liveBatch, userId, PREDICTIONS_LIST_LIVE_OPTS)
      : [],
  ]);

  const enrichedById = new Map(
    [...lightEnriched, ...liveEnriched].map((match) => [match.id, match])
  );
  return matches
    .map((match) => enrichedById.get(match._id.toString()))
    .filter(Boolean);
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
