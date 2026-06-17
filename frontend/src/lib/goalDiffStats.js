const GOAL_DIFF_MAX_AVG_ERROR = 4;

export function goalDiffScore(difGl, difGv, pj) {
  const games = pj ?? 0;
  if (games <= 0) return null;
  const avgErrorPerMatch = ((difGl ?? 0) + (difGv ?? 0)) / games;
  return Math.max(0, 1 - avgErrorPerMatch / GOAL_DIFF_MAX_AVG_ERROR);
}

/** 1.000 = todos los goles exactos; .750, etc. */
export function formatGoalDiffScore(difGl, difGv, pj) {
  const score = goalDiffScore(difGl, difGv, pj);
  if (score == null) return '—';
  const fixed = score.toFixed(3);
  return fixed.startsWith('0.') ? fixed.slice(1) : fixed;
}
