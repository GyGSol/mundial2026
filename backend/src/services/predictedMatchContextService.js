import { Match } from '../models/Match.js';
import { Prediction } from '../models/Prediction.js';
import { Stadium } from '../models/Stadium.js';
import { Team } from '../models/Team.js';
import { computePredictedGroupStandings } from './predictedGroupStandingsService.js';
import { buildPredictedKnockoutPhases } from './predictedKnockoutService.js';
import { annotateGroupQualification } from './worldCupStatsService.js';
import { rankBestThirdPlaceTeams } from './thirdPlaceRanking.js';
import { isGroupPhaseMatch } from './groupStandingsUtils.js';

export function isOfficialKnockoutMatch(match) {
  const id = String(match.externalId || '');
  return /^\d+$/.test(id) && Number(id) >= 73 && Number(id) <= 104;
}

export function indexResolvedKnockoutPhases(phases = []) {
  const map = new Map();
  for (const phase of phases) {
    for (const match of phase.matches) {
      map.set(String(match.externalId), {
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        homeTeamSlotLabel: match.homeTeamSlotLabel,
        awayTeamSlotLabel: match.awayTeamSlotLabel,
        knockoutPhase: phase.label,
        knockoutPhaseKey: phase.key,
      });
    }
  }
  return map;
}

export async function buildUserPredictedMatchContext(userId) {
  const [teams, allMatches, stadiums] = await Promise.all([
    Team.find({ group: { $exists: true, $ne: '' } }).lean(),
    Match.find().sort({ kickoffAt: 1 }).lean(),
    Stadium.find().lean(),
  ]);

  const groupMatches = allMatches.filter(isGroupPhaseMatch);
  const knockoutMatches = allMatches.filter(isOfficialKnockoutMatch);
  const relevantMatchIds = [
    ...groupMatches.map((m) => m._id),
    ...knockoutMatches.map((m) => m._id),
  ];

  const predictions = await Prediction.find({
    userId,
    matchId: { $in: relevantMatchIds },
  }).lean();

  const predictionsByMatchId = new Map(
    predictions.map((p) => [
      p.matchId.toString(),
      {
        homeGoals: p.homeGoals,
        awayGoals: p.awayGoals,
        userSubmitted: Boolean(p.userSubmitted),
      },
    ])
  );

  const rawGroups = computePredictedGroupStandings(teams, groupMatches, predictionsByMatchId);
  const thirdPlaceRanked = rankBestThirdPlaceTeams(rawGroups);
  const groups = annotateGroupQualification(rawGroups);
  const teamMap = Object.fromEntries(teams.map((team) => [team.externalId, team]));
  const stadiumMap = Object.fromEntries(stadiums.map((stadium) => [stadium.externalId, stadium]));

  const knockout = buildPredictedKnockoutPhases({
    groupStandings: groups,
    knockoutMatches,
    predictionsByMatchId,
    teamMap,
    stadiumMap,
  });

  return {
    teams,
    groups,
    thirdPlaceRanked,
    teamMap,
    stadiumMap,
    knockout,
    resolvedKnockoutByExternalId: indexResolvedKnockoutPhases(knockout.phases),
  };
}

export function applyResolvedKnockoutToMatch(match, resolved) {
  if (!resolved) return match;

  return {
    ...match,
    isKnockout: true,
    knockoutPhase: resolved.knockoutPhase,
    homeTeam: resolved.homeTeam ?? match.homeTeam,
    awayTeam: resolved.awayTeam ?? match.awayTeam,
    homeTeamSlotLabel: resolved.homeTeam ? null : resolved.homeTeamSlotLabel,
    awayTeamSlotLabel: resolved.awayTeam ? null : resolved.awayTeamSlotLabel,
  };
}
