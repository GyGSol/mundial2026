import { Match } from '../models/Match.js';
import { Team } from '../models/Team.js';
import { Prediction } from '../models/Prediction.js';
import { hasUserPrediction } from './predictionLockService.js';
import {
  extractTeamAbbreviation,
  fetchAllCalendarMatches,
  getCachedAllCalendarMatches,
} from './fifaApiClient.js';
import { resolveFifaCode, fifaCodesForRankingLookup } from '../data/teamFifaAliases.js';

const GROUP_STAGE_MATCH_NUMBER_MAX = 104;

function extractGroupLetter(entry) {
  const descriptions = entry?.GroupName;
  const text = Array.isArray(descriptions)
    ? descriptions.find((item) => item.Locale === 'en-GB')?.Description ?? descriptions[0]?.Description
    : String(descriptions ?? '');
  const match = String(text).match(/Group\s+([A-L])/i);
  return match ? match[1].toUpperCase() : '';
}

export function buildTeamIdByFifaCode(teams) {
  const byCode = new Map();
  for (const team of teams) {
    const code = String(team.fifaCode ?? '').toUpperCase();
    if (!code) continue;
    byCode.set(code, team.externalId);
    for (const alias of fifaCodesForRankingLookup(code)) {
      if (!byCode.has(alias)) byCode.set(alias, team.externalId);
    }
  }
  return byCode;
}

export function resolveTeamExternalId(fifaCode, teamIdByFifaCode) {
  const normalized = resolveFifaCode(fifaCode);
  if (!normalized) return null;
  return teamIdByFifaCode.get(normalized) ?? teamIdByFifaCode.get(fifaCode) ?? null;
}

export function buildFifaFixtureTargets(calendar, teamIdByFifaCode) {
  const targets = new Map();

  for (const entry of calendar) {
    const matchNumber = Number(entry.MatchNumber);
    if (!Number.isFinite(matchNumber) || matchNumber < 1 || matchNumber > GROUP_STAGE_MATCH_NUMBER_MAX) {
      continue;
    }

    const homeCode = extractTeamAbbreviation(entry.Home).toUpperCase();
    const awayCode = extractTeamAbbreviation(entry.Away).toUpperCase();
    const homeTeamId = resolveTeamExternalId(homeCode, teamIdByFifaCode);
    const awayTeamId = resolveTeamExternalId(awayCode, teamIdByFifaCode);

    if (!homeTeamId || !awayTeamId) continue;

    targets.set(String(matchNumber), {
      externalId: String(matchNumber),
      homeCode,
      awayCode,
      homeTeamId,
      awayTeamId,
      group: extractGroupLetter(entry),
      fifaMeta: {
        idMatch: entry.IdMatch,
        idStage: entry.IdStage,
        matchNumber,
        homeTeamId: entry.Home?.IdTeam,
        awayTeamId: entry.Away?.IdTeam,
      },
    });
  }

  return targets;
}

function pairKey(homeCode, awayCode) {
  return `${homeCode}-${awayCode}`;
}

async function remapPredictionsForTeamRotation({
  matchesByExternalId,
  targets,
  teamCodeByExternalId,
  externalIdByPair,
}) {
  let moved = 0;
  let merged = 0;
  let deleted = 0;
  let conflicted = 0;

  for (const [externalId, target] of targets) {
    const match = matchesByExternalId.get(externalId);
    if (!match) continue;

    const currentHome = teamCodeByExternalId.get(match.homeTeamId) ?? '';
    const currentAway = teamCodeByExternalId.get(match.awayTeamId) ?? '';
    const currentPair = pairKey(currentHome, currentAway);
    const targetPair = pairKey(target.homeCode, target.awayCode);

    if (!currentHome || currentPair === targetPair) continue;

    const intendedExternalId = externalIdByPair.get(currentPair);
    if (!intendedExternalId || intendedExternalId === externalId) continue;

    const destination = matchesByExternalId.get(intendedExternalId);
    if (!destination) continue;

    const predictions = await Prediction.find({ matchId: match._id });
    for (const prediction of predictions) {
      const existingOnDestination = await Prediction.findOne({
        userId: prediction.userId,
        matchId: destination._id,
      });

      if (!existingOnDestination) {
        await Prediction.updateOne({ _id: prediction._id }, { $set: { matchId: destination._id } });
        moved += 1;
        continue;
      }

      const sourceValuable = hasUserPrediction(prediction);
      const destValuable = hasUserPrediction(existingOnDestination);

      if (sourceValuable && !destValuable) {
        await Prediction.updateOne(
          { _id: existingOnDestination._id },
          {
            $set: {
              homeGoals: prediction.homeGoals,
              awayGoals: prediction.awayGoals,
              userSubmitted: prediction.userSubmitted,
              predictionSource:
                prediction.userSubmitted && prediction.predictionSource === 'default'
                  ? 'user'
                  : (prediction.predictionSource ?? 'user'),
              aiModel: prediction.aiModel ?? null,
              aiReasoning: prediction.aiReasoning ?? null,
            },
          }
        );
        await Prediction.deleteOne({ _id: prediction._id });
        merged += 1;
        continue;
      }

      if (!sourceValuable) {
        await Prediction.deleteOne({ _id: prediction._id });
        deleted += 1;
        continue;
      }

      conflicted += 1;
    }
  }

  return { moved, merged, deleted, conflicted };
}

export async function alignMatchesFromFifaCalendar(calendar = null) {
  const entries = calendar ?? (await getCachedAllCalendarMatches());
  const teams = await Team.find().select('externalId fifaCode').lean();
  const teamIdByFifaCode = buildTeamIdByFifaCode(teams);
  const targets = buildFifaFixtureTargets(entries, teamIdByFifaCode);

  const teamCodeById = new Map(
    teams.map((team) => [team.externalId, String(team.fifaCode ?? '').toUpperCase()])
  );

  const externalIds = [...targets.keys()];
  const matches = await Match.find({ externalId: { $in: externalIds } }).lean();
  const matchesByExternalId = new Map(matches.map((match) => [match.externalId, match]));

  const externalIdByPair = new Map(
    [...targets.values()].map((target) => [pairKey(target.homeCode, target.awayCode), target.externalId])
  );

  const teamCodeByExternalId = new Map(
    [...matchesByExternalId.values()].flatMap((match) => {
      const home = teamCodeById.get(match.homeTeamId);
      const away = teamCodeById.get(match.awayTeamId);
      return [
        [match.homeTeamId, home],
        [match.awayTeamId, away],
      ];
    })
  );

  const remapResult = await remapPredictionsForTeamRotation({
    matchesByExternalId,
    targets,
    teamCodeByExternalId,
    externalIdByPair,
  });

  let aligned = 0;
  let skipped = 0;

  for (const [externalId, target] of targets) {
    const match = matchesByExternalId.get(externalId);
    if (!match) {
      skipped += 1;
      continue;
    }

    const needsTeams =
      match.homeTeamId !== target.homeTeamId || match.awayTeamId !== target.awayTeamId;
    const needsGroup = target.group && match.group !== target.group;

    if (!needsTeams && !needsGroup) continue;

    const update = {
      homeTeamId: target.homeTeamId,
      awayTeamId: target.awayTeamId,
      'raw.fifaMeta': target.fifaMeta,
    };
    if (needsGroup) update.group = target.group;

    await Match.updateOne({ _id: match._id }, { $set: update });
    aligned += 1;
  }

  return {
    aligned,
    skipped,
    predictionsMoved: remapResult.moved,
    predictionsMerged: remapResult.merged,
    predictionsDeleted: remapResult.deleted,
    predictionsConflicted: remapResult.conflicted,
    targets: targets.size,
  };
}
