import { Match } from '../models/Match.js';
import { Stadium } from '../models/Stadium.js';
import { Team } from '../models/Team.js';
import { getFifaWorldRankings } from './aiTeamMatchContextService.js';
import { buildKnockoutPhases, WORLD_CUP_MATCH_SELECT } from './worldCupStatsService.js';

export const KNOCKOUT_EXTERNAL_IDS = Array.from({ length: 32 }, (_, index) => String(73 + index));

/**
 * Proyección por inclusión para contexto de predicciones knockout.
 * No mezclar `-raw` con `raw.*` (MongoDB: "Cannot do exclusion on field raw in inclusion projection").
 */
export const KNOCKOUT_CONTEXT_MATCH_SELECT =
  'externalId homeTeamId awayTeamId homeScore awayScore group matchday localDate stadiumId type status finishedAt kickoffAt kickoffTimezone liveStartedPushSentAt weatherOps raw.home_team_label raw.away_team_label raw.homeTeamLabel raw.awayTeamLabel raw.fifaMeta';

export function applyOfficialKnockoutDisplay(enriched, official) {
  if (!official) return enriched;

  return {
    ...enriched,
    homeTeam: official.homeTeam ?? enriched.homeTeam,
    awayTeam: official.awayTeam ?? enriched.awayTeam,
    homeTeamSlotLabel: official.homeTeam ? null : official.homeTeamSlotLabel,
    awayTeamSlotLabel: official.awayTeam ? null : official.awayTeamSlotLabel,
    homeTeamSlotSourceMatch: official.homeTeam ? null : official.homeTeamSlotSourceMatch,
    awayTeamSlotSourceMatch: official.awayTeam ? null : official.awayTeamSlotSourceMatch,
    knockoutPhase: official.phaseLabel ?? enriched.knockoutPhase,
  };
}

function knockoutSideNeedsOfficialFallback(match) {
  const homeEmpty = !match.homeTeam && !match.homeTeamSlotLabel && !match.homeTeamSlotSourceMatch;
  const awayEmpty = !match.awayTeam && !match.awayTeamSlotLabel && !match.awayTeamSlotSourceMatch;
  return homeEmpty && awayEmpty;
}

export async function loadOfficialKnockoutDisplayByExternalId(targetExternalIds) {
  const targetSet = new Set(targetExternalIds.map(String));
  const needsKnockout = [...targetSet].some((id) => {
    const n = Number(id);
    return Number.isFinite(n) && n >= 73 && n <= 104;
  });
  if (!needsKnockout) return {};

  const [knockoutMatches, teams, stadiums, rankings] = await Promise.all([
    Match.find({ externalId: { $in: KNOCKOUT_EXTERNAL_IDS } })
      .select(WORLD_CUP_MATCH_SELECT)
      .lean(),
    Team.find({}).lean(),
    Stadium.find({}).lean(),
    getFifaWorldRankings(),
  ]);

  const teamMap = Object.fromEntries(teams.map((team) => [team.externalId, team]));
  const stadiumMap = Object.fromEntries(stadiums.map((stadium) => [stadium.externalId, stadium]));
  const phases = buildKnockoutPhases(knockoutMatches, teamMap, stadiumMap, rankings);

  const byExternalId = {};
  for (const phase of phases) {
    for (const match of phase.matches) {
      const key = String(match.externalId);
      if (targetSet.has(key)) {
        byExternalId[key] = match;
      }
    }
  }
  return byExternalId;
}

/**
 * Merge official knockout display when user-predicted resolution left both sides empty.
 *
 * @param {object[]} enrichedMatches
 * @param {Record<string, object>} [officialByExternalId]
 */
export function mergeOfficialKnockoutFallback(enrichedMatches, officialByExternalId = {}) {
  if (!officialByExternalId || !Object.keys(officialByExternalId).length) {
    return enrichedMatches;
  }

  return enrichedMatches.map((match) => {
    const externalId = String(match.externalId || '');
    const n = Number(externalId);
    if (!Number.isFinite(n) || n < 73 || n > 104) return match;
    if (!knockoutSideNeedsOfficialFallback(match)) return match;

    const official = officialByExternalId[externalId];
    return official ? applyOfficialKnockoutDisplay(match, official) : match;
  });
}
