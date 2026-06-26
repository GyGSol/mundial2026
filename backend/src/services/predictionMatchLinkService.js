import { Match } from '../models/Match.js';
import { Team } from '../models/Team.js';
import { Prediction } from '../models/Prediction.js';
import { User } from '../models/User.js';
import { hasUserPrediction } from './predictionLockService.js';
import {
  buildFifaFixtureTargets,
  buildTeamIdByFifaCode,
} from './fifaFixtureAlignmentService.js';
import { fetchAllCalendarMatches, getCachedAllCalendarMatches } from './fifaApiClient.js';

export function pairKey(homeCode, awayCode) {
  return `${homeCode}-${awayCode}`;
}

/** Pure decision for remapping when destination already has a prediction. */
export function resolvePredictionRemapAction({ sourceValuable, destValuable, destExists }) {
  if (!destExists) return 'move';
  if (!sourceValuable) return 'delete_source';
  if (sourceValuable && !destValuable) return 'merge_and_delete_source';
  return 'conflict';
}

export async function loadFifaFixtureContext(calendar = null) {
  const entries = calendar ?? (await getCachedAllCalendarMatches());
  const teams = await Team.find().select('externalId fifaCode').lean();
  const teamIdByFifaCode = buildTeamIdByFifaCode(teams);
  const targets = buildFifaFixtureTargets(entries, teamIdByFifaCode);
  const teamCodeById = new Map(
    teams.map((team) => [team.externalId, String(team.fifaCode ?? '').toUpperCase()])
  );
  const pairToExternalId = new Map(
    [...targets.values()].map((target) => [
      pairKey(target.homeCode, target.awayCode),
      target.externalId,
    ])
  );

  return { targets, teamCodeById, pairToExternalId, teams };
}

export async function auditPredictionMatchLinks({
  calendar = null,
  upcomingCoverageLimit = 20,
} = {}) {
  const { targets, teamCodeById, pairToExternalId } = await loadFifaFixtureContext(calendar);

  const [matches, allPredictions, totalUsers] = await Promise.all([
    Match.find({ externalId: { $not: /^sim-/ } }).lean(),
    Prediction.find().lean(),
    User.countDocuments(),
  ]);

  const matchById = new Map(matches.map((match) => [String(match._id), match]));
  const allMatchIdSet = new Set(matches.map((match) => String(match._id)));

  const orphans = [];
  for (const prediction of allPredictions) {
    if (!allMatchIdSet.has(String(prediction.matchId))) {
      orphans.push({
        predictionId: String(prediction._id),
        matchId: String(prediction.matchId),
        userSubmitted: prediction.userSubmitted,
        valuable: hasUserPrediction(prediction),
      });
    }
  }

  const slotMismatches = [];
  for (const match of matches) {
    const target = targets.get(match.externalId);
    if (!target) continue;

    const home = teamCodeById.get(match.homeTeamId) ?? '?';
    const away = teamCodeById.get(match.awayTeamId) ?? '?';
    if (home === target.homeCode && away === target.awayCode) continue;

    const matchPredictions = allPredictions.filter(
      (prediction) => String(prediction.matchId) === String(match._id)
    );
    slotMismatches.push({
      externalId: match.externalId,
      db: `${home} vs ${away}`,
      fifa: `${target.homeCode} vs ${target.awayCode}`,
      valuablePredictions: matchPredictions.filter(hasUserPrediction).length,
    });
  }

  const misplacedValuable = [];
  for (const match of matches) {
    const home = teamCodeById.get(match.homeTeamId) ?? '';
    const away = teamCodeById.get(match.awayTeamId) ?? '';
    if (!home || !away) continue;

    const intendedExternalId = pairToExternalId.get(pairKey(home, away));
    if (!intendedExternalId || intendedExternalId === match.externalId) continue;

    const valuableCount = allPredictions.filter(
      (prediction) =>
        String(prediction.matchId) === String(match._id) && hasUserPrediction(prediction)
    ).length;

    if (!valuableCount) continue;

    misplacedValuable.push({
      fromExternalId: match.externalId,
      toExternalId: intendedExternalId,
      pair: `${home} vs ${away}`,
      valuableCount,
    });
  }

  const userPairMap = new Map();
  for (const prediction of allPredictions) {
    if (!hasUserPrediction(prediction)) continue;
    const match = matchById.get(String(prediction.matchId));
    if (!match) continue;

    const home = teamCodeById.get(match.homeTeamId) ?? '';
    const away = teamCodeById.get(match.awayTeamId) ?? '';
    if (!home || !away) continue;

    const key = `${String(prediction.userId)}|${pairKey(home, away)}`;
    if (!userPairMap.has(key)) userPairMap.set(key, []);
    userPairMap.get(key).push(match.externalId);
  }

  const duplicateUserPair = [];
  for (const [key, externalIds] of userPairMap) {
    const unique = [...new Set(externalIds)];
    if (unique.length <= 1) continue;
    const [userId, pair] = key.split('|');
    duplicateUserPair.push({ userId, pair, externalIds: unique });
  }

  const inconsistentSourceCount = allPredictions.filter(
    (prediction) => prediction.userSubmitted && prediction.predictionSource === 'default'
  ).length;

  const upcoming = matches
    .filter((match) => match.status === 'upcoming' && /^\d+$/.test(String(match.externalId)))
    .sort((a, b) => Number(a.externalId) - Number(b.externalId))
    .slice(0, upcomingCoverageLimit);

  const coverage = upcoming.map((match) => {
    const matchPredictions = allPredictions.filter(
      (prediction) => String(prediction.matchId) === String(match._id)
    );
    return {
      externalId: match.externalId,
      userSubmitted: matchPredictions.filter((prediction) => prediction.userSubmitted).length,
      valuable: matchPredictions.filter(hasUserPrediction).length,
      totalPredictions: matchPredictions.length,
      totalUsers,
    };
  });

  const summary = {
    orphanCount: orphans.length,
    slotMismatchCount: slotMismatches.length,
    misplacedValuableSlots: misplacedValuable.length,
    misplacedValuableCount: misplacedValuable.reduce((sum, row) => sum + row.valuableCount, 0),
    duplicateUserPairCount: duplicateUserPair.length,
    inconsistentSourceCount,
    hasIssues:
      orphans.length > 0 ||
      misplacedValuable.length > 0 ||
      duplicateUserPair.length > 0 ||
      slotMismatches.some((row) => row.valuablePredictions > 0),
  };

  return {
    summary,
    orphans,
    slotMismatches,
    misplacedValuable,
    duplicateUserPair,
    inconsistentSource: { count: inconsistentSourceCount },
    coverage,
  };
}

export async function getMatchPredictionDiagnostics(matchNumber) {
  const externalId = String(matchNumber ?? '').trim();
  if (!externalId) {
    const error = new Error('matchNumber requerido');
    error.status = 400;
    throw error;
  }

  const match = await Match.findOne({ externalId }).lean();
  if (!match) {
    return {
      externalId,
      found: false,
      userSubmitted: 0,
      valuable: 0,
      totalPredictions: 0,
      totalUsers: await User.countDocuments(),
    };
  }

  const [predictions, totalUsers] = await Promise.all([
    Prediction.find({ matchId: match._id }).lean(),
    User.countDocuments(),
  ]);

  return {
    externalId,
    found: true,
    matchId: String(match._id),
    status: match.status,
    userSubmitted: predictions.filter((prediction) => prediction.userSubmitted).length,
    valuable: predictions.filter(hasUserPrediction).length,
    totalPredictions: predictions.length,
    totalUsers,
  };
}

function predictionMergeFields(prediction) {
  return {
    homeGoals: prediction.homeGoals,
    awayGoals: prediction.awayGoals,
    userSubmitted: prediction.userSubmitted,
    predictionSource:
      prediction.userSubmitted && prediction.predictionSource === 'default'
        ? 'user'
        : (prediction.predictionSource ?? 'user'),
    aiModel: prediction.aiModel ?? null,
    aiReasoning: prediction.aiReasoning ?? null,
  };
}

export async function repairMisplacedPredictions({
  apply = false,
  mergePreferSource = false,
  calendar = null,
} = {}) {
  const { targets, teamCodeById, pairToExternalId } = await loadFifaFixtureContext(calendar);

  const matches = await Match.find({ externalId: { $in: [...targets.keys()] } }).lean();
  const matchesByExternalId = new Map(matches.map((match) => [match.externalId, match]));

  const teamCodeByExternalId = new Map(
    matches.flatMap((match) => {
      const home = teamCodeById.get(match.homeTeamId);
      const away = teamCodeById.get(match.awayTeamId);
      return [
        [match.homeTeamId, home],
        [match.awayTeamId, away],
      ];
    })
  );

  let moved = 0;
  let merged = 0;
  let deleted = 0;
  let conflicted = 0;
  const actions = [];

  for (const [externalId, target] of targets) {
    const match = matchesByExternalId.get(externalId);
    if (!match) continue;

    const currentHome = teamCodeByExternalId.get(match.homeTeamId) ?? '';
    const currentAway = teamCodeByExternalId.get(match.awayTeamId) ?? '';
    const currentPair = pairKey(currentHome, currentAway);
    const targetPair = pairKey(target.homeCode, target.awayCode);

    if (!currentHome || currentPair === targetPair) continue;

    const intendedExternalId = pairToExternalId.get(currentPair);
    if (!intendedExternalId || intendedExternalId === externalId) continue;

    const destination = matchesByExternalId.get(intendedExternalId);
    if (!destination) continue;

    const predictions = await Prediction.find({ matchId: match._id });
    for (const prediction of predictions) {
      const existingOnDestination = await Prediction.findOne({
        userId: prediction.userId,
        matchId: destination._id,
      });

      const sourceValuable = hasUserPrediction(prediction);
      const destValuable = hasUserPrediction(existingOnDestination);
      const action = resolvePredictionRemapAction({
        sourceValuable,
        destValuable,
        destExists: Boolean(existingOnDestination),
      });

      if (action === 'move') {
        actions.push({
          type: 'move',
          predictionId: String(prediction._id),
          fromExternalId: externalId,
          toExternalId: intendedExternalId,
        });
        if (apply) {
          await Prediction.updateOne(
            { _id: prediction._id },
            { $set: { matchId: destination._id } }
          );
          moved += 1;
        }
        continue;
      }

      if (action === 'delete_source') {
        actions.push({
          type: 'delete_source',
          predictionId: String(prediction._id),
          fromExternalId: externalId,
          toExternalId: intendedExternalId,
        });
        if (apply) {
          await Prediction.deleteOne({ _id: prediction._id });
          deleted += 1;
        }
        continue;
      }

      if (action === 'merge_and_delete_source') {
        actions.push({
          type: 'merge_and_delete_source',
          predictionId: String(prediction._id),
          destinationPredictionId: String(existingOnDestination._id),
          fromExternalId: externalId,
          toExternalId: intendedExternalId,
        });
        if (apply) {
          await Prediction.updateOne(
            { _id: existingOnDestination._id },
            { $set: predictionMergeFields(prediction) }
          );
          await Prediction.deleteOne({ _id: prediction._id });
          merged += 1;
        }
        continue;
      }

      if (action === 'conflict') {
        if (apply && mergePreferSource && existingOnDestination) {
          actions.push({
            type: 'merge_prefer_source',
            predictionId: String(prediction._id),
            destinationPredictionId: String(existingOnDestination._id),
            fromExternalId: externalId,
            toExternalId: intendedExternalId,
          });
          await Prediction.updateOne(
            { _id: existingOnDestination._id },
            { $set: predictionMergeFields(prediction) }
          );
          await Prediction.deleteOne({ _id: prediction._id });
          merged += 1;
        } else {
          actions.push({
            type: 'conflict',
            predictionId: String(prediction._id),
            fromExternalId: externalId,
            toExternalId: intendedExternalId,
          });
          conflicted += 1;
        }
      }
    }
  }

  return {
    dryRun: !apply,
    moved,
    merged,
    deleted,
    conflicted,
    actions,
  };
}
