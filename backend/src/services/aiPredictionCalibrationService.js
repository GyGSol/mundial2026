import { Prediction } from '../models/Prediction.js';
import { goalDiffScore } from './goalDiffStats.js';
import { aggregateMatchPredictions } from './aiCrowdPredictionContextService.js';

const DEFAULT_WINDOW = 20;
const MIN_NUDGE_SAMPLES = 10;
const POST_MATCH_HINT_WINDOW = 8;
const HUMAN_REF_WINDOW = 15;

/** Sesgo de goles predichos vs reales (positivo = sobreestimó). */
export function computeObservedGoalBias(prediction, match) {
  const actualHome = match?.homeScore ?? 0;
  const actualAway = match?.awayScore ?? 0;
  return {
    biasHome: (prediction?.homeGoals ?? 0) - actualHome,
    biasAway: (prediction?.awayGoals ?? 0) - actualAway,
  };
}

/** Extrae la sección de calibración del informe markdown. */
export function extractCalibrationSection(analysisText) {
  if (!analysisText?.trim()) return '';
  const match = analysisText.match(
    /###\s*Ajuste sugerido de calibraci[oó]n\s*([\s\S]*?)(?=###\s|$)/i
  );
  return match?.[1]?.trim() ?? '';
}

/**
 * Parsea texto libre del informe post-partido a sesgo numérico aproximado.
 * Positivo = el bot tendió a predecir de más goles en ese lado.
 */
export function parseCalibrationHintFromText(analysisText) {
  const section = extractCalibrationSection(analysisText);
  if (!section) return null;

  const text = section.toLowerCase();
  const summary = section.split('\n')[0]?.trim() ?? section.slice(0, 200);

  const parseSide = (sideKeywords) => {
    const sidePattern = sideKeywords.join('|');
    const sideBlock = text.match(new RegExp(`(${sidePattern})[\\s\\S]{0,120}`, 'i'));
    if (!sideBlock) return null;

    const chunk = sideBlock[0];
    const numMatch = chunk.match(/([+-]?\d+[.,]\d+|\d+)\s*gol/i);
    if (numMatch) {
      const n = Number(String(numMatch[1]).replace(',', '.'));
      if (Number.isFinite(n)) {
        const sign =
          chunk.includes('subestim') || chunk.includes('menos goles') || chunk.includes('bajar')
            ? -Math.abs(n)
            : Math.abs(n);
        return sign;
      }
    }

    if (/sobreestim|de m[aá]s|demasiados|alto|inflad|exceso|m[aá]s goles/.test(chunk)) return 0.6;
    if (/subestim|de menos|bajo|pocos|menos goles|faltaron/.test(chunk)) return -0.6;
    return null;
  };

  const biasHome = parseSide(['local', 'casa', 'home', 'equipo local']);
  const biasAway = parseSide(['visitante', 'away', 'equipo visitante', 'rival']);

  if (biasHome == null && biasAway == null) return { summary, biasHome: null, biasAway: null };

  return { summary, biasHome, biasAway };
}

/** Combina sesgo observado en el partido con el parseo del informe. */
export function buildCalibrationHintFromReview(prediction, match, analysisText) {
  const observed = computeObservedGoalBias(prediction, match);
  const parsed = parseCalibrationHintFromText(analysisText);

  const blend = (observedVal, parsedVal) => {
    if (parsedVal == null) return observedVal;
    return Number((0.65 * observedVal + 0.35 * parsedVal).toFixed(2));
  };

  return {
    biasHome: blend(observed.biasHome, parsed?.biasHome ?? null),
    biasAway: blend(observed.biasAway, parsed?.biasAway ?? null),
    observedBiasHome: observed.biasHome,
    observedBiasAway: observed.biasAway,
    summary:
      parsed?.summary ??
      (extractCalibrationSection(analysisText).slice(0, 280) || null),
    generatedAt: new Date(),
  };
}

export async function loadPostMatchCalibrationHints(aiUserId, { windowSize = POST_MATCH_HINT_WINDOW } = {}) {
  const preds = await Prediction.find({
    userId: aiUserId,
    predictionSource: 'ai',
    'aiPostMatchReview.calibrationHint.biasHome': { $exists: true },
    'aiPostMatchReview.resultScoreKey': { $exists: true },
  })
    .sort({ 'aiPostMatchReview.generatedAt': -1 })
    .limit(windowSize)
    .select('aiPostMatchReview.calibrationHint')
    .lean();

  if (!preds.length) return null;

  let sumH = 0;
  let sumA = 0;
  for (const p of preds) {
    const hint = p.aiPostMatchReview?.calibrationHint ?? {};
    sumH += hint.biasHome ?? 0;
    sumA += hint.biasAway ?? 0;
  }

  const n = preds.length;
  return {
    partidos: n,
    avgBiasHome: Number((sumH / n).toFixed(2)),
    avgBiasAway: Number((sumA / n).toFixed(2)),
  };
}

/** Consenso humano de un partido (todos los grupos, excluye IA). */
export async function loadHumanConsensusForMatch(matchId, { excludeUserId } = {}) {
  const preds = await Prediction.find({
    matchId,
    userSubmitted: true,
  })
    .populate('userId', 'isAiUser')
    .select('homeGoals awayGoals userId')
    .lean();

  const humans = preds.filter(
    (p) => !p.userId?.isAiUser && String(p.userId?._id ?? p.userId) !== String(excludeUserId)
  );
  if (!humans.length) return null;
  return aggregateMatchPredictions(humans);
}

/** Cuánto se desvía la IA del consenso humano en partidos recientes puntuados. */
export async function loadHumanReferenceCalibration(aiUserId, { windowSize = HUMAN_REF_WINDOW } = {}) {
  const aiPreds = await Prediction.find({
    userId: aiUserId,
    predictionSource: 'ai',
    goalDiffHome: { $ne: null },
  })
    .sort({ updatedAt: -1 })
    .limit(windowSize)
    .select('matchId homeGoals awayGoals')
    .lean();

  if (!aiPreds.length) return null;

  const matchIds = aiPreds.map((p) => p.matchId);
  const humanPreds = await Prediction.find({
    matchId: { $in: matchIds },
    userSubmitted: true,
  })
    .populate('userId', 'isAiUser')
    .select('matchId homeGoals awayGoals userId')
    .lean();

  const humansByMatch = new Map();
  for (const p of humanPreds) {
    if (p.userId?.isAiUser) continue;
    const key = p.matchId.toString();
    if (!humansByMatch.has(key)) humansByMatch.set(key, []);
    humansByMatch.get(key).push(p);
  }

  let sumHome = 0;
  let sumAway = 0;
  let count = 0;

  for (const ai of aiPreds) {
    const humans = humansByMatch.get(ai.matchId.toString());
    if (!humans?.length) continue;
    const agg = aggregateMatchPredictions(humans);
    if (agg.mediana?.local == null || agg.mediana?.visitante == null) continue;
    sumHome += (ai.homeGoals ?? 0) - agg.mediana.local;
    sumAway += (ai.awayGoals ?? 0) - agg.mediana.visitante;
    count += 1;
  }

  if (!count) return null;

  return {
    partidosConHumanos: count,
    aiVsHumanMedianHome: Number((sumHome / count).toFixed(2)),
    aiVsHumanMedianAway: Number((sumAway / count).toFixed(2)),
  };
}

function mergeCalibrationBiases(rollingHome, rollingAway, postMatchHints, humanRef) {
  let home = rollingHome;
  let away = rollingAway;

  if (postMatchHints) {
    home = 0.55 * home + 0.45 * postMatchHints.avgBiasHome;
    away = 0.55 * away + 0.45 * postMatchHints.avgBiasAway;
  }

  if (humanRef) {
    home = 0.75 * home + 0.25 * humanRef.aiVsHumanMedianHome;
    away = 0.75 * away + 0.25 * humanRef.aiVsHumanMedianAway;
  }

  return {
    avgErrorHome: Number(home.toFixed(2)),
    avgErrorAway: Number(away.toFixed(2)),
  };
}

export async function loadAiCalibrationStats(aiUserId, { windowSize = DEFAULT_WINDOW } = {}) {
  const [preds, postMatchHints, humanRef] = await Promise.all([
    Prediction.find({
      userId: aiUserId,
      predictionSource: 'ai',
      goalDiffHome: { $ne: null },
      goalDiffAway: { $ne: null },
    })
      .sort({ updatedAt: -1 })
      .limit(windowSize)
      .select('goalDiffHome goalDiffAway matchId homeGoals awayGoals')
      .lean(),
    loadPostMatchCalibrationHints(aiUserId),
    loadHumanReferenceCalibration(aiUserId),
  ]);

  if (!preds.length) {
    return {
      partidosAnalizados: 0,
      errorCombinado: null,
      sesgoLocal: null,
      sesgoVisitante: null,
      nota: 'Sin historial de predicciones puntuadas aún',
      puedeAjustar: false,
      postMatchHints,
      humanReference: humanRef,
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
  const rollingBiasHome = biasHome / n;
  const rollingBiasAway = biasAway / n;
  const merged = mergeCalibrationBiases(rollingBiasHome, rollingBiasAway, postMatchHints, humanRef);
  const avgBiasHome = merged.avgErrorHome;
  const avgBiasAway = merged.avgErrorAway;
  const err = goalDiffScore(difGl, difGv, n);

  const notes = [];
  if (avgBiasHome > 0.4) notes.push('Tendés a errar de más en goles del local');
  if (avgBiasAway > 0.4) notes.push('Tendés a errar de más en goles del visitante');
  if (lowScoringMiss >= Math.ceil(n / 3)) notes.push('En partidos bajos marcaste demasiados goles');
  if (drawsUnderestimated >= Math.ceil(n / 4)) notes.push('Subestimaste empates en varios partidos');
  if (postMatchHints?.partidos >= 3) {
    notes.push(`Calibración post-partido activa (${postMatchHints.partidos} informes)`);
  }
  if (humanRef?.partidosConHumanos >= 3) {
    const dir =
      humanRef.aiVsHumanMedianHome > 0.3
        ? 'más goles locales que el consenso humano'
        : humanRef.aiVsHumanMedianHome < -0.3
          ? 'menos goles locales que el consenso humano'
          : null;
    if (dir) notes.push(`Vs humanos: ${dir}`);
  }

  const puedeAjustar =
    n >= MIN_NUDGE_SAMPLES || (postMatchHints?.partidos ?? 0) >= 5;

  return {
    partidosAnalizados: n,
    errorCombinado: Number(err.toFixed(3)),
    sesgoLocal: avgBiasHome > 0 ? `+${avgBiasHome} goles de error promedio` : `${avgBiasHome}`,
    sesgoVisitante: avgBiasAway > 0 ? `+${avgBiasAway} goles de error promedio` : `${avgBiasAway}`,
    nota: notes.length ? notes.join('. ') : 'Error dentro de rango normal',
    puedeAjustar,
    avgErrorHome: avgBiasHome,
    avgErrorAway: avgBiasAway,
    rollingBiasHome: Number(rollingBiasHome.toFixed(2)),
    rollingBiasAway: Number(rollingBiasAway.toFixed(2)),
    postMatchHints,
    humanReference: humanRef,
  };
}

export function buildCalibrationPromptBlock(stats) {
  if (!stats || stats.partidosAnalizados === 0) return null;
  const block = {
    partidosAnalizados: stats.partidosAnalizados,
    errorCombinado: stats.errorCombinado,
    sesgoLocal: stats.sesgoLocal,
    sesgoVisitante: stats.sesgoVisitante,
    nota: stats.nota,
  };

  if (stats.postMatchHints?.partidos) {
    block.ajustesPostPartido = {
      partidos: stats.postMatchHints.partidos,
      sesgoLocal: stats.postMatchHints.avgBiasHome,
      sesgoVisitante: stats.postMatchHints.avgBiasAway,
    };
  }

  if (stats.humanReference?.partidosConHumanos) {
    block.referenciaHumanos = {
      partidos: stats.humanReference.partidosConHumanos,
      iaVsMedianaLocal: stats.humanReference.aiVsHumanMedianHome,
      iaVsMedianaVisitante: stats.humanReference.aiVsHumanMedianAway,
      nota: 'Positivo = la IA predice más goles que la mediana humana en esos partidos',
    };
  }

  return block;
}

export function applyCalibrationNudge(score, stats) {
  if (!score || !stats?.puedeAjustar) return { ...score, calibrationApplied: false };

  let home = score.homeGoals;
  let away = score.awayGoals;
  const threshold = stats.postMatchHints?.partidos >= 5 ? 0.4 : 0.5;

  if (stats.avgErrorHome > threshold && home > 0) home -= 1;
  else if (stats.avgErrorHome < -threshold) home += 1;

  if (stats.avgErrorAway > threshold && away > 0) away -= 1;
  else if (stats.avgErrorAway < -threshold) away += 1;

  home = Math.max(0, Math.min(10, home));
  away = Math.max(0, Math.min(10, away));

  if (home === score.homeGoals && away === score.awayGoals) {
    return { ...score, calibrationApplied: false };
  }

  const sources = ['sesgo rolling'];
  if (stats.postMatchHints?.partidos) sources.push('informes post-partido');
  if (stats.humanReference?.partidosConHumanos) sources.push('consenso humano');

  return {
    ...score,
    homeGoals: home,
    awayGoals: away,
    calibrationApplied: true,
    reasoning: `${score.reasoning ?? ''}\n\n_Ajuste por calibración (${sources.join(', ')})._`.trim(),
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

  const agg = aggregateMatchPredictions(humans);
  const humanGd =
    humans.reduce((acc, p) => acc + (p.goalDiffHome ?? 0) + (p.goalDiffAway ?? 0), 0) /
    humans.length;
  const aiGd = (ai.goalDiffHome ?? 0) + (ai.goalDiffAway ?? 0);

  return {
    aiGoalDiff: aiGd,
    humanAvgGoalDiff: Number(humanGd.toFixed(2)),
    humanCount: humans.length,
    humanMedian: agg.mediana,
    humanFrequentOutcome: agg.resultadoFrecuente,
    humanOutcomePercent: agg.porcentajeResultadoFrecuente,
    aiScore: { home: ai.homeGoals, away: ai.awayGoals },
  };
}
