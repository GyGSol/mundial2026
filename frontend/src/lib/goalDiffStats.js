function avgGoalDiffPerMatch(totalDiff, pj) {
  const games = pj ?? 0;
  if (games <= 0) return 0;
  return (totalDiff ?? 0) / games;
}

/** Error combinado; .000 = perfecto, 1.000 = peor caso. */
export function goalDiffScore(difGl, difGv, pj) {
  const games = pj ?? 0;
  if (games <= 0) return null;
  const glDif = avgGoalDiffPerMatch(difGl, games);
  const gvDif = avgGoalDiffPerMatch(difGv, games);
  const combined = (glDif * gvDif) / 2;
  return Math.min(1, combined / 2);
}

/** .000 = sin error; .199, 1.000 = máximo. */
export function formatGoalDiffScore(difGl, difGv, pj) {
  const score = goalDiffScore(difGl, difGv, pj);
  if (score == null) return '—';
  const fixed = score.toFixed(3);
  return fixed.startsWith('0.') ? fixed.slice(1) : fixed;
}
