function goalHitRate(hits, pj) {
  const games = pj ?? 0;
  if (games <= 0) return 0;
  return (hits ?? 0) / games;
}

/** Gdif = (GL/PJ × GV/PJ) / 2, escalado ×2 → 1.000 = todos los goles exactos. */
export function goalDiffScore(gl, gv, pj) {
  const games = pj ?? 0;
  if (games <= 0) return null;
  const localRate = goalHitRate(gl, games);
  const visitRate = goalHitRate(gv, games);
  const raw = (localRate * visitRate) / 2;
  return Math.min(1, raw * 2);
}

/** 1.000 = todos los goles exactos; .110, etc. */
export function formatGoalDiffScore(gl, gv, pj) {
  const score = goalDiffScore(gl, gv, pj);
  if (score == null) return '—';
  const fixed = score.toFixed(3);
  return fixed.startsWith('0.') ? fixed.slice(1) : fixed;
}
