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
 * Error combinado (GLdif × GVdif) / 2 escalado 0–1.
 * .000 = sin error; 1.000 = peor caso (~2 goles de error promedio por lado).
 */
export function goalDiffScore(difGl, difGv, pj) {
  const games = pj ?? 0;
  if (games <= 0) return 0;
  const glDif = goalDiffLocalAvg(difGl, games);
  const gvDif = goalDiffVisitAvg(difGv, games);
  const combined = (glDif * gvDif) / 2;
  return Math.min(1, combined / 2);
}

/** Menor error = mejor posición. */
export function compareGoalDiffScore(aDifGl, aDifGv, aPj, bDifGl, bDifGv, bPj) {
  const aErr = goalDiffScore(aDifGl, aDifGv, aPj);
  const bErr = goalDiffScore(bDifGl, bDifGv, bPj);
  if (aErr !== bErr) return aErr - bErr;
  return 0;
}
