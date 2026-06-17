/** Promedio de error en goles por partido (dif acumulada ÷ PJ). */
export function avgGoalDiffPerMatch(totalDiff, pj) {
  const games = pj ?? 0;
  if (games <= 0) return 0;
  return (totalDiff ?? 0) / games;
}

export function compareAvgGoalDiff(aDiff, aPj, bDiff, bPj) {
  const aAvg = avgGoalDiffPerMatch(aDiff, aPj);
  const bAvg = avgGoalDiffPerMatch(bDiff, bPj);
  if (aAvg !== bAvg) return aAvg - bAvg;
  return 0;
}

/** Error combinado (local+visitante) que mapea Gdif a 0.000 en el peor caso razonable. */
export const GOAL_DIFF_MAX_AVG_ERROR = 4;

/**
 * Precisión combinada local+visitante (0–1).
 * 1.000 = cero error en todos los goles; baja según (difGl+difGv)/PJ.
 * Escala: ~2 errores promedio por partido → ~0.500; 4 o más → 0.000.
 */
export function goalDiffScore(difGl, difGv, pj) {
  const games = pj ?? 0;
  if (games <= 0) return 0;
  const avgErrorPerMatch = ((difGl ?? 0) + (difGv ?? 0)) / games;
  return Math.max(0, 1 - avgErrorPerMatch / GOAL_DIFF_MAX_AVG_ERROR);
}

/** Mayor Gdif = mejor posición. */
export function compareGoalDiffScore(aDifGl, aDifGv, aPj, bDifGl, bDifGv, bPj) {
  const aScore = goalDiffScore(aDifGl, aDifGv, aPj);
  const bScore = goalDiffScore(bDifGl, bDifGv, bPj);
  if (bScore !== aScore) return bScore - aScore;
  return 0;
}
