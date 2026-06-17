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

/** Tasa de acierto por lado: GL/PJ o GV/PJ. */
export function goalHitRate(hits, pj) {
  const games = pj ?? 0;
  if (games <= 0) return 0;
  return (hits ?? 0) / games;
}

/** Mayor tasa = mejor posición. */
export function compareHitRate(aHits, aPj, bHits, bPj) {
  const aRate = goalHitRate(aHits, aPj);
  const bRate = goalHitRate(bHits, bPj);
  if (bRate !== aRate) return bRate - aRate;
  return 0;
}

/**
 * Gdif = (GL/PJ × GV/PJ) / 2, escalado ×2 → 1.000 si acertaste local y visitante en todos los partidos.
 */
export function goalDiffScore(gl, gv, pj) {
  const games = pj ?? 0;
  if (games <= 0) return 0;
  const localRate = goalHitRate(gl, games);
  const visitRate = goalHitRate(gv, games);
  const raw = (localRate * visitRate) / 2;
  return Math.min(1, raw * 2);
}

/** Mayor Gdif = mejor posición. */
export function compareGoalDiffScore(aGl, aGv, aPj, bGl, bGv, bPj) {
  const aScore = goalDiffScore(aGl, aGv, aPj);
  const bScore = goalDiffScore(bGl, bGv, bPj);
  if (bScore !== aScore) return bScore - aScore;
  return 0;
}
