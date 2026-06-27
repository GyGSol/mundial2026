import { assignPlayerChartColors } from './playerChartColors.js';
import {
  accumulateLeaderboardStats,
  calculateGoalDiff,
  compareLeaderboardEntries,
  createEmptyLeaderboardStats,
} from './leaderboardStats.js';

function teamCode(team) {
  if (!team) return null;
  return team.fifaCode?.trim() || team.nameEn?.slice(0, 3).toUpperCase() || null;
}

function formatCheckpointLabel(match, teamByExternalId) {
  const homeTeam = teamByExternalId.get(match.homeTeamId);
  const awayTeam = teamByExternalId.get(match.awayTeamId);
  const home = teamCode(homeTeam) ?? match.homeTeamId;
  const away = teamCode(awayTeam) ?? match.awayTeamId;
  return `${home} · ${away}`;
}

function compareMatchesChronologically(a, b) {
  const aKick = a.kickoffAt ? new Date(a.kickoffAt).getTime() : 0;
  const bKick = b.kickoffAt ? new Date(b.kickoffAt).getTime() : 0;
  if (aKick !== bKick) return aKick - bKick;
  return String(a.externalId).localeCompare(String(b.externalId));
}

function computeRanksByUserId(users, statsByUserId) {
  const rows = users.map((user) => {
    const userId = user.id;
    const stats = statsByUserId.get(userId) ?? createEmptyLeaderboardStats();
    return { userId, name: user.name, ...stats };
  });
  rows.sort(compareLeaderboardEntries);
  return new Map(rows.map((row, index) => [row.userId, index + 1]));
}

function appendRankSnapshot(users, statsByUserId, ranksSeriesByUserId) {
  const ranksByUserId = computeRanksByUserId(users, statsByUserId);
  for (const user of users) {
    ranksSeriesByUserId.get(user.id).push(ranksByUserId.get(user.id));
  }
}

function goalDiffForPrediction(prediction, match) {
  if (prediction.goalDiffHome != null || prediction.goalDiffAway != null) {
    return {
      home: prediction.goalDiffHome ?? 0,
      away: prediction.goalDiffAway ?? 0,
    };
  }
  return calculateGoalDiff(
    { home: prediction.homeGoals, away: prediction.awayGoals },
    { home: match.homeScore ?? 0, away: match.awayScore ?? 0 }
  );
}

/**
 * Construye checkpoints + series de evolución desde payload raw del API.
 * @param {{
 *   group: object | null,
 *   users: Array<{ id: string, name: string, isAiUser?: boolean, avatarUrl?: string | null }>,
 *   matches: Array<{ id: string, externalId: string, kickoffAt?: string, homeTeamId: string, awayTeamId: string, homeScore?: number, awayScore?: number }>,
 *   predictions: Array<{ userId: string, matchId: string, pointsEarned: number, bonusPoint?: number, pointsBreakdown?: object, goalDiffHome?: number, goalDiffAway?: number, homeGoals: number, awayGoals: number }>,
 *   teams: Array<{ externalId: string, fifaCode?: string, nameEn?: string }>,
 *   hasLiveMatches?: boolean,
 * }} raw
 */
export function buildPointsEvolutionFromRaw(raw) {
  const users = raw.users ?? [];
  if (!users.length) {
    return {
      group: raw.group ?? null,
      checkpoints: [{ index: 0, label: 'Inicio', matchId: null }],
      series: [],
      hasLiveMatches: Boolean(raw.hasLiveMatches),
      lastUpdatedAt: new Date().toISOString(),
    };
  }

  const matches = [...(raw.matches ?? [])].sort(compareMatchesChronologically);
  const teamByExternalId = new Map((raw.teams ?? []).map((team) => [team.externalId, team]));

  const predictionByUserMatch = new Map(
    (raw.predictions ?? []).map((prediction) => [`${prediction.userId}:${prediction.matchId}`, prediction])
  );

  const checkpoints = [
    { index: 0, label: 'Inicio', matchId: null },
    ...matches.map((match, idx) => ({
      index: idx + 1,
      label: formatCheckpointLabel(match, teamByExternalId),
      matchId: match.id,
    })),
  ];

  const statsByUserId = new Map(users.map((user) => [user.id, createEmptyLeaderboardStats()]));
  const ranksSeriesByUserId = new Map(users.map((user) => [user.id, [0]]));

  for (const match of matches) {
    for (const user of users) {
      const prediction = predictionByUserMatch.get(`${user.id}:${match.id}`);
      if (!prediction) continue;

      const stats = statsByUserId.get(user.id);
      accumulateLeaderboardStats(
        stats,
        prediction.pointsBreakdown,
        prediction.pointsEarned,
        prediction.bonusPoint ?? 0,
        goalDiffForPrediction(prediction, match)
      );
    }
    appendRankSnapshot(users, statsByUserId, ranksSeriesByUserId);
  }

  const finalRanks = computeRanksByUserId(users, statsByUserId);
  const sortedUsers = [...users].sort((a, b) => {
    const rankA = finalRanks.get(a.id) ?? users.length;
    const rankB = finalRanks.get(b.id) ?? users.length;
    if (rankA !== rankB) return rankA - rankB;
    return a.name.localeCompare(b.name, 'es');
  });

  const colorByUserId = assignPlayerChartColors(users.map((user) => user.id));

  const series = sortedUsers.map((user) => ({
    userId: user.id,
    name: user.name,
    avatarUrl: user.avatarUrl ?? null,
    isAiUser: Boolean(user.isAiUser),
    color: colorByUserId.get(user.id),
    ranks: ranksSeriesByUserId.get(user.id) ?? [],
  }));

  return {
    group: raw.group ?? null,
    checkpoints,
    series,
    hasLiveMatches: Boolean(raw.hasLiveMatches),
    lastUpdatedAt: new Date().toISOString(),
  };
}
