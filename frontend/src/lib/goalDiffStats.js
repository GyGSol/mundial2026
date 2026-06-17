export function avgGoalDiffPerMatch(totalDiff, pj) {
  const games = pj ?? 0;
  if (games <= 0) return null;
  return (totalDiff ?? 0) / games;
}

/** Muestra promedio con 3 decimales: .654 o 1.234 */
export function formatAvgGoalDiff(totalDiff, pj) {
  const avg = avgGoalDiffPerMatch(totalDiff, pj);
  if (avg == null) return '—';
  const fixed = avg.toFixed(3);
  return fixed.startsWith('0.') ? fixed.slice(1) : fixed;
}
