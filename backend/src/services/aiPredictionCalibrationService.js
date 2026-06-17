import { Prediction } from '../models/Prediction.js';
import { goalDiffScore } from './goalDiffStats.js';

const DEFAULT_WINDOW = 20;
const MIN_NUDGE_SAMPLES = 10;

export async function loadAiCalibrationStats(aiUserId, { windowSize = DEFAULT_WINDOW } = {}) {
  const preds = await Prediction.find({
    userId: aiUserId,
    predictionSource: 'ai',
    goalDiffHome: { $ne: null },
    goalDiffAway: { $ne: null },
  })
    .sort({ updatedAt: -1 })
    .limit(windowSize)
    .select('goalDiffHome goalDiffAway matchId homeGoals awayGoals')
    .lean();

  if (!preds.length) {
    return {
      partidosAnalizados: 0,
      errorCombinado: null,
      sesgoLocal: null,
      sesgoVisitante: null,
      nota: 'Sin historial de predicciones puntuadas aún',
      puedeAjustar: false,
    };
  }

  let difGl = 0;
  let difGv = 0;
  let biasHome = 0;
  let biasAway = 0;
  let drawsUnderestimated = 0;
  let lowScoringMiss = 0;

  for (const p of preds) {
    difGl += p.goalDiffHome ?? 0;
    difGv += p.goalDiffAway ?? 0;
    biasHome += p.goalDiffHome ?? 0;
    biasAway += p.goalDiffAway ?? 0;
    if ((p.homeGoals ?? 0) + (p.awayGoals ?? 0) > 2 && (p.goalDiffHome ?? 0) + (p.goalDiffAway ?? 0) >= 3) {
      lowScoringMiss += 1;
    }
    if (p.homeGoals === p.awayGoals && (p.goalDiffHome ?? 0) + (p.goalDiffAway ?? 0) > 0) {
      drawsUnderestimated += 1;
    }
  }

  const n = preds.length;
  const avgBiasHome = Number((biasHome / n).toFixed(2));
  const avgBiasAway = Number((biasAway / n).toFixed(2));
  const err = goalDiffScore(difGl, difGv, n);

  const notes = [];
  if (avgBiasHome > 0.4) notes.push('Tendés a errar de más en goles del local');
  if (avgBiasAway > 0.4) notes.push('Tendés a errar de más en goles del visitante');
  if (lowScoringMiss >= Math.ceil(n / 3)) notes.push('En partidos bajos marcaste demasiados goles');
  if (drawsUnderestimated >= Math.ceil(n / 4)) notes.push('Subestimaste empates en varios partidos');

  return {
    partidosAnalizados: n,
    errorCombinado: Number(err.toFixed(3)),
    sesgoLocal: avgBiasHome > 0 ? `+${avgBiasHome} goles de error promedio` : `${avgBiasHome}`,
    sesgoVisitante: avgBiasAway > 0 ? `+${avgBiasAway} goles de error promedio` : `${avgBiasAway}`,
    nota: notes.length ? notes.join('. ') : 'Error dentro de rango normal',
    puedeAjustar: n >= MIN_NUDGE_SAMPLES,
    avgErrorHome: avgBiasHome,
    avgErrorAway: avgBiasAway,
  };
}

export function buildCalibrationPromptBlock(stats) {
  if (!stats || stats.partidosAnalizados === 0) return null;
  return {
    partidosAnalizados: stats.partidosAnalizados,
    errorCombinado: stats.errorCombinado,
    sesgoLocal: stats.sesgoLocal,
    sesgoVisitante: stats.sesgoVisitante,
    nota: stats.nota,
  };
}

export function applyCalibrationNudge(score, stats) {
  if (!score || !stats?.puedeAjustar) return { ...score, calibrationApplied: false };

  let home = score.homeGoals;
  let away = score.awayGoals;

  if (stats.avgErrorHome > 0.5 && home > 0) home -= 1;
  else if (stats.avgErrorHome < -0.5) home += 1;

  if (stats.avgErrorAway > 0.5 && away > 0) away -= 1;
  else if (stats.avgErrorAway < -0.5) away += 1;

  home = Math.max(0, Math.min(10, home));
  away = Math.max(0, Math.min(10, away));

  if (home === score.homeGoals && away === score.awayGoals) {
    return { ...score, calibrationApplied: false };
  }

  return {
    ...score,
    homeGoals: home,
    awayGoals: away,
    calibrationApplied: true,
    reasoning: `${score.reasoning ?? ''}\n\n_Ajuste por calibración Gdif (sesgo rolling)._`.trim(),
  };
}

export async function compareAiVsHumansOnMatch(matchId, aiUserId) {
  const preds = await Prediction.find({
    matchId,
    userSubmitted: true,
    pointsEarned: { $ne: null },
  })
    .populate('userId', 'isAiUser')
    .lean();

  const ai = preds.find((p) => String(p.userId?._id ?? p.userId) === String(aiUserId));
  const humans = preds.filter((p) => !p.userId?.isAiUser);
  if (!ai || !humans.length) return null;

  const humanGd =
    humans.reduce(
      (acc, p) => acc + (p.goalDiffHome ?? 0) + (p.goalDiffAway ?? 0),
      0
    ) / humans.length;
  const aiGd = (ai.goalDiffHome ?? 0) + (ai.goalDiffAway ?? 0);

  return {
    aiGoalDiff: aiGd,
    humanAvgGoalDiff: Number(humanGd.toFixed(2)),
    humanCount: humans.length,
  };
}
