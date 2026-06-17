/** Promedio de error en goles por partido (dif acumulada ÷ PJ). */
export function avgGoalDiffPerMatch(totalDiff, pj) {
  const games = pj ?? 0;
  if (games <= 0) return 0;
  return (totalDiff ?? 0) / games;
}

/** Menor promedio = mejor posición (desempate). */
export function compareAvgGoalDiff(aDiff, aPj, bDiff, bPj) {
  const aAvg = avgGoalDiffPerMatch(aDiff, aPj);
  const bAvg = avgGoalDiffPerMatch(bDiff, bPj);
  if (aAvg !== bAvg) return aAvg - bAvg;
  return 0;
}

/** Error promedio local por partido (predicción vs resultado). */
export function goalDiffLocalAvg(difGl, pj) {
  return avgGoalDiffPerMatch(difGl, pj);
}

/** Error promedio visitante por partido. */
export function goalDiffVisitAvg(difGv, pj) {
  return avgGoalDiffPerMatch(difGv, pj);
}

/**
 * Gdif = (GLdif × GVdif) / 2, con GLdif/GVdif = error promedio por lado.
 * Escala 0–1: 1.000 = cero error local y visitante; baja con el producto.
 */
export function goalDiffScore(difGl, difGv, pj) {
  const games = pj ?? 0;
  if (games <= 0) return 0;
  const glDif = goalDiffLocalAvg(difGl, games);
  const gvDif = goalDiffVisitAvg(difGv, games);
  const combined = (glDif * gvDif) / 2;
  return Math.max(0, 1 - combined / 2);
}

/** Mayor Gdif = mejor posición. */
export function compareGoalDiffScore(aDifGl, aDifGv, aPj, bDifGl, bDifGv, bPj) {
  const aScore = goalDiffScore(aDifGl, aDifGv, aPj);
  const bScore = goalDiffScore(bDifGl, bDifGv, bPj);
  if (bScore !== aScore) return bScore - aScore;
  return 0;
}
