import {
  compareAvgGoalDiff,
  compareGoalDiffScore,
} from './goalDiffStats.js';

function emptyStats() {
  return { pj: 0, pa: 0, gl: 0, gv: 0, gt: 0, pb: 0, difGl: 0, difGv: 0, totalPoints: 0 };
}

export function createEmptyLeaderboardStats() {
  return emptyStats();
}

export function accumulateLeaderboardStats(stats, breakdown, pointsEarned, bonusPoint = 0, goalDiff = null) {
  stats.pj += 1;
  if ((breakdown?.winner ?? 0) > 0) stats.pa += 1;
  if ((breakdown?.homeGoals ?? 0) > 0) stats.gl += 1;
  if ((breakdown?.awayGoals ?? 0) > 0) stats.gv += 1;
  if ((breakdown?.totalGoals ?? 0) > 0) stats.gt += 1;
  stats.pb += bonusPoint ?? 0;
  stats.difGl += goalDiff?.home ?? 0;
  stats.difGv += goalDiff?.away ?? 0;
  stats.totalPoints += (pointsEarned ?? 0) + (bonusPoint ?? 0);
}

export function compareRankingEntries(a, b) {
  const pointsA = a.points ?? a.totalPoints ?? 0;
  const pointsB = b.points ?? b.totalPoints ?? 0;
  if (pointsB !== pointsA) return pointsB - pointsA;
  if (b.pa !== a.pa) return b.pa - a.pa;

  const glgvA = (a.gl ?? 0) + (a.gv ?? 0);
  const glgvB = (b.gl ?? 0) + (b.gv ?? 0);
  if (glgvB !== glgvA) return glgvB - glgvA;

  if (b.gt !== a.gt) return b.gt - a.gt;
  if (a.pb !== b.pb) return a.pb - b.pb;
  const gdifCmp = compareGoalDiffScore(a.difGl, a.difGv, a.pj, b.difGl, b.difGv, b.pj);
  if (gdifCmp !== 0) return gdifCmp;
  const difLocalCmp = compareAvgGoalDiff(a.difGl, a.pj, b.difGl, b.pj);
  if (difLocalCmp !== 0) return difLocalCmp;
  const difVisitCmp = compareAvgGoalDiff(a.difGv, a.pj, b.difGv, b.pj);
  if (difVisitCmp !== 0) return difVisitCmp;
  return a.name.localeCompare(b.name, 'es');
}

export const compareLeaderboardEntries = compareRankingEntries;

/** Diferencia absoluta entre predicción y resultado real por equipo. */
export function calculateGoalDiff(prediction, actual) {
  return {
    home: Math.abs((prediction.home ?? 0) - (actual.home ?? 0)),
    away: Math.abs((prediction.away ?? 0) - (actual.away ?? 0)),
  };
}
