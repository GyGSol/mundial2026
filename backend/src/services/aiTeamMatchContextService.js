import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { lookupFifaRankInTable } from '../data/teamFifaAliases.js';
import { getWorldCupHistory } from './worldCupHistoryService.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RANKINGS_PATH = join(__dirname, '../data/fifaWorldRankings2026.json');

let cachedRankings = null;
let cachedRankingsMtime = null;

export async function getFifaWorldRankings() {
  const stat = await import('fs/promises').then((fs) => fs.stat(RANKINGS_PATH));
  if (cachedRankings && cachedRankingsMtime === stat.mtimeMs) {
    return cachedRankings;
  }
  const raw = JSON.parse(await readFile(RANKINGS_PATH, 'utf8'));
  cachedRankings = {
    asOf: raw.asOf ?? null,
    source: raw.source ?? null,
    byCode: raw.rankings ?? {},
  };
  cachedRankingsMtime = stat.mtimeMs;
  return cachedRankings;
}

export function extractFifaRankingFromTeam(team, rankingsByCode = {}) {
  const code = String(team?.fifaCode ?? '').toUpperCase();
  const seededRank = lookupFifaRankInTable(code, rankingsByCode);
  if (seededRank != null) {
    return { rank: seededRank, source: 'fifa_ranking_jun_2026' };
  }

  const raw = team?.raw;
  if (!raw || typeof raw !== 'object') return null;

  const rank = Number(
    raw.fifa_rank ??
      raw.fifaRank ??
      raw.world_rank ??
      raw.worldRank ??
      raw.ranking ??
      raw.rank ??
      NaN
  );
  if (!Number.isFinite(rank) || rank <= 0) return null;
  return { rank: Math.round(rank), source: 'team_api' };
}

function matchInvolvesTeam(match, teamExternalId) {
  const id = String(teamExternalId ?? '');
  return match.homeTeamId === id || match.awayTeamId === id;
}

function teamScoreInMatch(match, teamExternalId) {
  if (match.homeTeamId === teamExternalId) return Number(match.homeScore ?? 0);
  if (match.awayTeamId === teamExternalId) return Number(match.awayScore ?? 0);
  return null;
}

function opponentInMatch(match, teamExternalId, teamById) {
  const opponentId =
    match.homeTeamId === teamExternalId ? match.awayTeamId : match.homeTeamId;
  const opponent = teamById[opponentId];
  return {
    code: opponent?.fifaCode ?? opponentId,
    name: opponent?.nameEn ?? opponentId,
  };
}

function resultLetter(match, teamExternalId) {
  const gf = teamScoreInMatch(match, teamExternalId);
  const ga =
    match.homeTeamId === teamExternalId
      ? Number(match.awayScore ?? 0)
      : Number(match.homeScore ?? 0);
  if (gf == null) return null;
  if (gf > ga) return 'W';
  if (gf < ga) return 'L';
  return 'D';
}

function isCountableTournamentMatch(match, { beforeKickoffMs, excludeExternalId }) {
  if (!match || (match.status !== 'finished' && match.status !== 'live')) return false;
  if (excludeExternalId && String(match.externalId) === String(excludeExternalId)) {
    return false;
  }
  const kickoffMs = match.kickoffAt ? new Date(match.kickoffAt).getTime() : NaN;
  if (Number.isFinite(beforeKickoffMs) && Number.isFinite(kickoffMs) && kickoffMs >= beforeKickoffMs) {
    return false;
  }
  return true;
}

export function aggregateTournamentStats(teamExternalId, allMatches, options = {}) {
  const stats = {
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    cleanSheets: 0,
  };

  for (const match of allMatches) {
    if (!matchInvolvesTeam(match, teamExternalId)) continue;
    if (!isCountableTournamentMatch(match, options)) continue;

    const gf = teamScoreInMatch(match, teamExternalId) ?? 0;
    const ga =
      match.homeTeamId === teamExternalId
        ? Number(match.awayScore ?? 0)
        : Number(match.homeScore ?? 0);
    const letter = resultLetter(match, teamExternalId);

    stats.played += 1;
    stats.goalsFor += gf;
    stats.goalsAgainst += ga;
    if (ga === 0) stats.cleanSheets += 1;
    if (letter === 'W') stats.wins += 1;
    else if (letter === 'D') stats.draws += 1;
    else if (letter === 'L') stats.losses += 1;
  }

  return stats;
}

export function classifyOffensivePower(goalsPerGame) {
  if (goalsPerGame >= 2) return 'alto';
  if (goalsPerGame >= 1.2) return 'medio';
  if (goalsPerGame > 0) return 'bajo';
  return 'sin_datos';
}

export function classifyDefensivePower(concededPerGame) {
  if (concededPerGame <= 0.6) return 'fuerte';
  if (concededPerGame <= 1.2) return 'medio';
  if (concededPerGame > 0) return 'débil';
  return 'sin_datos';
}

export function buildPowerMetricsFromStats(stats) {
  const played = stats?.played ?? 0;
  const goalsFor = stats?.goalsFor ?? 0;
  const goalsAgainst = stats?.goalsAgainst ?? 0;
  const goalsPerGame = played > 0 ? Number((goalsFor / played).toFixed(2)) : null;
  const concededPerGame = played > 0 ? Number((goalsAgainst / played).toFixed(2)) : null;

  return {
    offensive: {
      goalsFor,
      goalsPerGame,
      tier: goalsPerGame == null ? 'sin_datos' : classifyOffensivePower(goalsPerGame),
    },
    defensive: {
      goalsAgainst,
      concededPerGame,
      cleanSheets: stats?.cleanSheets ?? 0,
      tier: concededPerGame == null ? 'sin_datos' : classifyDefensivePower(concededPerGame),
    },
  };
}

export function buildRecentTournamentResults(
  teamExternalId,
  allMatches,
  teamById,
  { beforeKickoffMs, excludeExternalId, limit = 5 } = {}
) {
  const results = [];

  for (let i = allMatches.length - 1; i >= 0 && results.length < limit; i -= 1) {
    const match = allMatches[i];
    if (!matchInvolvesTeam(match, teamExternalId)) continue;
    if (!isCountableTournamentMatch(match, { beforeKickoffMs, excludeExternalId })) continue;

    const gf = teamScoreInMatch(match, teamExternalId);
    const ga =
      match.homeTeamId === teamExternalId
        ? Number(match.awayScore ?? 0)
        : Number(match.homeScore ?? 0);
    const opponent = opponentInMatch(match, teamExternalId, teamById);
    const side = match.homeTeamId === teamExternalId ? 'local_fixture' : 'visitante_fixture';

    results.push({
      date: match.kickoffAt?.toISOString?.()?.slice(0, 10) ?? null,
      opponent: opponent.code ?? opponent.name,
      score: `${gf}-${ga}`,
      result: resultLetter(match, teamExternalId),
      phase: match.group ? `grupo ${match.group}` : match.type ?? 'eliminatoria',
      side,
    });
  }

  return results;
}

export function buildHeadToHeadInTournament(
  homeTeamId,
  awayTeamId,
  allMatches,
  teamById,
  { beforeKickoffMs, excludeExternalId } = {}
) {
  const meetings = [];

  for (const match of allMatches) {
    const involves =
      (match.homeTeamId === homeTeamId && match.awayTeamId === awayTeamId) ||
      (match.homeTeamId === awayTeamId && match.awayTeamId === homeTeamId);
    if (!involves) continue;
    if (!isCountableTournamentMatch(match, { beforeKickoffMs, excludeExternalId })) continue;

    meetings.push({
      date: match.kickoffAt?.toISOString?.()?.slice(0, 10) ?? null,
      score: `${match.homeScore ?? 0}-${match.awayScore ?? 0}`,
      home: teamById[match.homeTeamId]?.fifaCode ?? match.homeTeamId,
      away: teamById[match.awayTeamId]?.fifaCode ?? match.awayTeamId,
      phase: match.group ? `grupo ${match.group}` : match.type ?? 'eliminatoria',
    });
  }

  return meetings;
}

export function buildWorldCupPedigree(fifaCode, history) {
  if (!fifaCode || !history) {
    return { worldCupTitles: 0, finalsPlayed: 0, lastFinalYear: null };
  }

  const code = String(fifaCode).toUpperCase();
  const titles =
    history.titlesByNation?.find((row) => String(row.fifaCode).toUpperCase() === code)?.titles ?? 0;

  const finals = (history.finals ?? []).filter(
    (row) =>
      String(row.winnerFifa ?? '').toUpperCase() === code ||
      String(row.runnerUpFifa ?? '').toUpperCase() === code
  );
  const lastFinalYear = finals.length
    ? finals[finals.length - 1]?.year ?? null
    : null;

  return {
    worldCupTitles: titles,
    finalsPlayed: finals.length,
    lastFinalYear,
  };
}

function standingRowForTeam(standingsByGroup, team) {
  if (!team?.group) return null;
  const groupTable = standingsByGroup.find(
    (g) => g.group === String(team.group).toUpperCase()
  );
  return (
    groupTable?.standings?.find(
      (row) => row.teamId === team.externalId || row.fifaCode === team.fifaCode
    ) ?? null
  );
}

export function buildTeamMatchAnalysis(
  team,
  {
    standingsByGroup = [],
    allMatches = [],
    teamById = {},
    rankingsByCode = {},
    history = null,
    beforeKickoffMs,
    excludeExternalId,
    fixtureRole,
  } = {}
) {
  if (!team?.externalId) return null;

  const standingRow = standingRowForTeam(standingsByGroup, team);
  const tournamentStats = aggregateTournamentStats(team.externalId, allMatches, {
    beforeKickoffMs,
    excludeExternalId,
  });

  const standingPlayed = Number(standingRow?.played ?? 0);
  const statsForPower =
    standingPlayed > 0
      ? {
          played: standingPlayed,
          goalsFor: Number(standingRow?.goalsFor ?? 0),
          goalsAgainst: Number(standingRow?.goalsAgainst ?? 0),
          cleanSheets: 0,
        }
      : tournamentStats;

  const power = buildPowerMetricsFromStats(statsForPower);
  const recentResults = buildRecentTournamentResults(
    team.externalId,
    allMatches,
    teamById,
    { beforeKickoffMs, excludeExternalId }
  );
  const form = recentResults
    .map((row) => row.result)
    .filter(Boolean)
    .join('');

  const fifaRanking = extractFifaRankingFromTeam(team, rankingsByCode);
  const pedigree = buildWorldCupPedigree(team.fifaCode, history);

  return {
    externalId: team.externalId,
    name: team.nameEn,
    code: team.fifaCode ?? null,
    group: team.group ?? null,
    fixtureRole: fixtureRole ?? null,
    fifaRanking,
    groupStanding: standingRow
      ? {
          rank: standingRow.rank,
          played: standingRow.played,
          points: standingRow.points,
          goalsFor: standingRow.goalsFor,
          goalsAgainst: standingRow.goalsAgainst,
          goalDiff: standingRow.goalDiff,
        }
      : null,
    tournament2026: {
      played: tournamentStats.played,
      wins: tournamentStats.wins,
      draws: tournamentStats.draws,
      losses: tournamentStats.losses,
      form: form || null,
      recentResults,
    },
    power,
    worldCupHistory: pedigree,
  };
}

export async function buildMatchTeamsAnalysis({
  homeTeam,
  awayTeam,
  match,
  allMatches,
  standingsByGroup,
  teamById,
}) {
  const [rankings, history] = await Promise.all([
    getFifaWorldRankings(),
    getWorldCupHistory().catch(() => null),
  ]);

  const beforeKickoffMs = match?.kickoffAt
    ? new Date(match.kickoffAt).getTime()
    : undefined;
  const excludeExternalId = match?.externalId;

  const baseOptions = {
    standingsByGroup,
    allMatches,
    teamById,
    rankingsByCode: rankings.byCode,
    history,
    beforeKickoffMs,
    excludeExternalId,
  };

  return {
    rankingsAsOf: rankings.asOf,
    home: buildTeamMatchAnalysis(homeTeam, {
      ...baseOptions,
      fixtureRole: 'local (solo fixture)',
    }),
    away: buildTeamMatchAnalysis(awayTeam, {
      ...baseOptions,
      fixtureRole: 'visitante (solo fixture)',
    }),
    headToHead2026:
      homeTeam?.externalId && awayTeam?.externalId
        ? buildHeadToHeadInTournament(
            homeTeam.externalId,
            awayTeam.externalId,
            allMatches,
            teamById,
            { beforeKickoffMs, excludeExternalId }
          )
        : [],
  };
}
