import fifaRankingsData from '../data/fifaWorldRankings2026.json' with { type: 'json' };
import { lookupFifaRankInTable } from '../data/teamFifaAliases.js';

const DEFAULT_FIFA_RANKINGS_BY_CODE = fifaRankingsData.rankings ?? {};

export function getDefaultFifaRankingsByCode() {
  return DEFAULT_FIFA_RANKINGS_BY_CODE;
}

export function resolveFifaRank(row, rankingsByCode = DEFAULT_FIFA_RANKINGS_BY_CODE) {
  if (row?.fifaRank != null && Number.isFinite(Number(row.fifaRank))) {
    return Number(row.fifaRank);
  }
  const code = String(row?.fifaCode ?? '').toUpperCase();
  if (!code) return null;
  const rank = lookupFifaRankInTable(code, rankingsByCode);
  return rank ?? null;
}

export function totalPlayedInStandings(rows) {
  return (rows ?? []).reduce((sum, row) => sum + Number(row.played ?? 0), 0);
}

export function createStanding(team) {
  const fifaRank = resolveFifaRank(team);
  return {
    teamId: team.externalId,
    nameEn: team.nameEn,
    fifaCode: team.fifaCode,
    flag: team.flag,
    ...(fifaRank != null ? { fifaRank } : {}),
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDiff: 0,
    points: 0,
  };
}

export function applyResult(standing, goalsFor, goalsAgainst) {
  standing.played += 1;
  standing.goalsFor += goalsFor;
  standing.goalsAgainst += goalsAgainst;
  standing.goalDiff = standing.goalsFor - standing.goalsAgainst;

  if (goalsFor > goalsAgainst) {
    standing.won += 1;
    standing.points += 3;
  } else if (goalsFor < goalsAgainst) {
    standing.lost += 1;
  } else {
    standing.drawn += 1;
    standing.points += 1;
  }
}

function compareByFifaRank(a, b, rankingsByCode) {
  const rankA = resolveFifaRank(a, rankingsByCode);
  const rankB = resolveFifaRank(b, rankingsByCode);
  if (rankA != null && rankB != null && rankA !== rankB) return rankA - rankB;
  if (rankA != null && rankB == null) return -1;
  if (rankA == null && rankB != null) return 1;
  return (a.nameEn || '').localeCompare(b.nameEn || '');
}

function compareByResults(a, b, rankingsByCode) {
  if (b.points !== a.points) return b.points - a.points;
  if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
  if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
  return compareByFifaRank(a, b, rankingsByCode);
}

export function sortStandings(rows, rankingsByCode = DEFAULT_FIFA_RANKINGS_BY_CODE) {
  const compare =
    totalPlayedInStandings(rows) === 0
      ? (a, b) => compareByFifaRank(a, b, rankingsByCode)
      : (a, b) => compareByResults(a, b, rankingsByCode);

  return [...rows].sort(compare);
}

export function normalizePhaseKey(type) {
  return String(type || 'group')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

export function isGroupPhaseMatch(match) {
  return normalizePhaseKey(match.type) === 'group';
}
