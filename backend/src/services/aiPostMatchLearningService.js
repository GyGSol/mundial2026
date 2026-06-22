import { Match } from '../models/Match.js';
import { Prediction } from '../models/Prediction.js';
import { AiCompetitorPredictionLog } from '../models/AiCompetitorPredictionLog.js';
import { callAiForText, getAiUser, hasAiProvider } from './aiPredictionService.js';
import {
  buildCalibrationHintFromReview,
  buildCalibrationPromptBlock,
  compareAiVsHumansOnMatch,
  loadAiCalibrationStats,
  loadHumanConsensusForMatch,
} from './aiPredictionCalibrationService.js';
import { goalDiffScore } from './goalDiffStats.js';
import { sanitizeAiUserFacingText, briefAiReasoning } from './aiPromptHumanizer.js';
import { prepareOracleContextPayload } from './oraclePromptContextService.js';
import { CEREBRAS_PRIORITIES } from './cerebrasQuotaManager.js';

export function matchResultScoreKey(match) {
  if (match?.homeScore == null || match?.awayScore == null) return null;
  return `${match.homeScore}-${match.awayScore}`;
}

function formatBreakdown(breakdown) {
  if (!breakdown) return 'sin desglose';
  const parts = [];
  if ((breakdown.winner ?? 0) > 0) parts.push('PA');
  if ((breakdown.homeGoals ?? 0) > 0) parts.push('GL');
  if ((breakdown.awayGoals ?? 0) > 0) parts.push('GV');
  if ((breakdown.totalGoals ?? 0) > 0) parts.push('GT');
  return parts.length ? parts.join(', ') : 'ninguno';
}

function formatHumanConsensus(humanConsensus, vsHumans) {
  if (!humanConsensus?.muestras) {
    return 'Sin predicciones humanas enviadas para este partido.';
  }
  const med = humanConsensus.mediana;
  return `Muestras: ${humanConsensus.muestras}
Mediana humana: ${med?.local ?? '—'}-${med?.visitante ?? '—'}
Resultado más frecuente: ${humanConsensus.resultadoFrecuente} (${humanConsensus.porcentajeResultadoFrecuente ?? 0}%)
Dispersión (σ): local ${humanConsensus.dispersion?.local ?? 0}, visitante ${humanConsensus.dispersion?.visitante ?? 0}
Bot vs mediana humana: ${vsHumans?.aiScore?.home ?? '?'}-${vsHumans?.aiScore?.away ?? '?'} vs ${med?.local ?? '?'}-${med?.visitante ?? '?'}`;
}

export function buildPostMatchReviewPrompt({
  match,
  prediction,
  promptContext,
  calibrationStats,
  humanConsensus,
  vsHumans,
}) {
  const actualHome = match.homeScore ?? 0;
  const actualAway = match.awayScore ?? 0;
  const gdif = goalDiffScore(
    prediction.goalDiffHome ?? 0,
    prediction.goalDiffAway ?? 0,
    1
  );

  return `Sos el analista de aprendizaje del bot "Predictive Modeling" del Mundial 2026.
Tu tarea es auditar UN partido ya finalizado: comparar la predicción guardada con el resultado real y los datos que se usaron antes del kickoff, para extraer lecciones que reduzcan el error Gdif (objetivo 0.000) en partidos futuros.

## Partido
- Etiqueta: ${match.homeTeamId ?? '?'} vs ${match.awayTeamId ?? '?'} (FIFA #${match.externalId ?? '?'})
- Grupo: ${match.group ?? '—'}
- Estado: finalizado
- Resultado real: ${actualHome}-${actualAway}

## Predicción del bot
- Marcador predicho: ${prediction.homeGoals}-${prediction.awayGoals}
- Fuente: ${prediction.predictionSource ?? 'desconocida'}${prediction.aiCalibrationApplied ? ' (con ajuste de calibración)' : ''}
- Puntos obtenidos: ${prediction.pointsEarned ?? 0}
- Aciertos parciales: ${formatBreakdown(prediction.pointsBreakdown)}
- Error Gdif del partido (local+visitante): GL ${prediction.goalDiffHome ?? 0} · GV ${prediction.goalDiffAway ?? 0}
- Índice Gdif combinado del partido (escala 0–1, menor mejor): ${Number(gdif.toFixed(3))}

## Razonamiento previo al partido
${prediction.aiReasoning?.trim() || 'No quedó guardado el razonamiento original.'}

## Contexto usado en la predicción (resumen)
${JSON.stringify(prepareOracleContextPayload(promptContext ?? {}, 'learning'))}

## Calibración rolling del bot (antes de este partido)
${JSON.stringify(buildCalibrationPromptBlock(calibrationStats) ?? { nota: 'Sin historial' }, null, 2)}

## Predicciones de otros jugadores (referencia)
${formatHumanConsensus(humanConsensus, vsHumans)}

## Instrucciones de salida
Escribí en español rioplatense un informe detallado en markdown para el panel de control admin. Estructura obligatoria:

### Resumen del error
Un párrafo: qué acertó, qué falló y cuánto costó en puntos/Gdif.

### Comparación predicción vs realidad
- Resultado y goles por equipo
- PA / GL / GV / GT: qué se ganó y qué se perdió
- Gdif: por qué el error de goles fue el que fue

### Señales que fallaron o acertaron
Analizá ranking, xG/mercado, clima, stakes de grupo, forma reciente u otros datos del contexto. Decí cuáles empujaron a un marcador incorrecto o correcto.

### Lecciones para bajar Gdif
3–5 bullets accionables para el modelo en partidos similares (no genéricos). Priorizá ajustes sobre señales del torneo 2026 (forma, goles reales) frente a ranking/xG si el error vino de sobreponderar lo segundo. Incluí si conviene empates, menos goles, más goles del local/visitante, etc.

### Ajuste sugerido de calibración
Una frase concreta sobre sesgo local/visitante detectado en ESTE partido (usa números si podés, ej. "+0.5 goles local") y cómo encaja con la calibración rolling y el consenso humano.

Compará brevemente si el bot estuvo más alejado del resultado que la mediana humana.

No inventes datos que no estén en el contexto. Máximo ~500 palabras.`;
}

export function formatPostMatchReviewRowMeta(match, prediction) {
  const available =
    match?.status === 'finished' &&
    prediction?.pointsEarned != null &&
    match?.homeScore != null &&
    match?.awayScore != null;

  if (!available) {
    return { available: false };
  }

  const scoreKey = matchResultScoreKey(match);
  const review = prediction.aiPostMatchReview ?? null;
  const generated = Boolean(review?.analysis?.trim());
  const stale = generated && review?.resultScoreKey !== scoreKey;

  return {
    available: true,
    generated: generated && !stale,
    stale,
    generatedAt: review?.generatedAt ? new Date(review.generatedAt).toISOString() : null,
    preview: generated && !stale ? briefAiReasoning(review.analysis, 220) : null,
  };
}

export async function getOrGenerateAiPostMatchReview(matchId, { refresh = false } = {}) {
  if (!hasAiProvider()) {
    const error = new Error('IA no configurada');
    error.status = 503;
    throw error;
  }

  const aiUser = await getAiUser();
  if (!aiUser) {
    const error = new Error('Usuario IA no configurado');
    error.status = 503;
    throw error;
  }

  const match = await Match.findById(matchId).lean();
  if (!match) {
    const error = new Error('Partido no encontrado');
    error.status = 404;
    throw error;
  }
  if (match.status !== 'finished') {
    const error = new Error('El análisis post-partido solo aplica a partidos finalizados');
    error.status = 400;
    throw error;
  }

  const prediction = await Prediction.findOne({ userId: aiUser._id, matchId: match._id });
  if (!prediction || prediction.pointsEarned == null) {
    const error = new Error('No hay predicción puntuada del bot para este partido');
    error.status = 404;
    throw error;
  }

  const scoreKey = matchResultScoreKey(match);
  const existing = prediction.aiPostMatchReview ?? null;
  if (!refresh && existing?.analysis?.trim() && existing.resultScoreKey === scoreKey) {
    return serializeReview(prediction, match);
  }

  const [officialLog, calibrationStats, humanConsensus] = await Promise.all([
    AiCompetitorPredictionLog.findOne({
      userId: aiUser._id,
      matchId: match._id,
      isSimulation: false,
    })
      .sort({ createdAt: -1 })
      .lean(),
    loadAiCalibrationStats(aiUser._id),
    loadHumanConsensusForMatch(match._id, { excludeUserId: aiUser._id }),
  ]);

  const vsHumans = await compareAiVsHumansOnMatch(match._id, aiUser._id);

  const prompt = buildPostMatchReviewPrompt({
    match,
    prediction: prediction.toObject(),
    promptContext: officialLog?.promptContext ?? null,
    calibrationStats,
    humanConsensus,
    vsHumans,
  });

  const { text, source } = await callAiForText(prompt, {
    cerebrasPriority: CEREBRAS_PRIORITIES.postMatchReview,
    cerebrasLabel: 'post-match-review',
  });
  const analysis = sanitizeAiUserFacingText(String(text ?? '').trim());
  if (!analysis) {
    const error = new Error('La IA no devolvió análisis');
    error.status = 502;
    throw error;
  }

  const calibrationHint = buildCalibrationHintFromReview(
    prediction.toObject(),
    match,
    analysis
  );

  prediction.aiPostMatchReview = {
    analysis,
    generatedAt: new Date(),
    aiSource: source ?? null,
    resultScoreKey: scoreKey,
    calibrationHint,
    humanConsensusAtReview: humanConsensus
      ? {
          muestras: humanConsensus.muestras,
          mediana: humanConsensus.mediana,
          resultadoFrecuente: humanConsensus.resultadoFrecuente,
        }
      : null,
  };
  await prediction.save();

  return serializeReview(prediction, match);
}

function serializeReview(prediction, match) {
  const review = prediction.aiPostMatchReview ?? {};
  const scoreKey = matchResultScoreKey(match);
  return {
    matchId: match._id.toString(),
    predictionId: prediction._id.toString(),
    analysis: review.analysis ?? '',
    generatedAt: review.generatedAt ? new Date(review.generatedAt).toISOString() : null,
    aiSource: review.aiSource ?? null,
    stale: review.resultScoreKey != null && review.resultScoreKey !== scoreKey,
    resultScoreKey: review.resultScoreKey ?? null,
    actualScore: {
      home: match.homeScore ?? null,
      away: match.awayScore ?? null,
    },
    predictedScore: {
      home: prediction.homeGoals,
      away: prediction.awayGoals,
    },
    pointsEarned: prediction.pointsEarned,
    goalDiffHome: prediction.goalDiffHome,
    goalDiffAway: prediction.goalDiffAway,
    pointsBreakdown: prediction.pointsBreakdown ?? null,
    originalReasoning: prediction.aiReasoning ?? null,
    calibrationHint: review.calibrationHint ?? null,
    humanConsensusAtReview: review.humanConsensusAtReview ?? null,
  };
}

/** Genera análisis en background al finalizar un partido (idempotente por marcador). */
export async function queueAiPostMatchReview(matchId) {
  if (!hasAiProvider()) return { queued: false, reason: 'no_ai' };

  const aiUser = await getAiUser();
  if (!aiUser) return { queued: false, reason: 'no_ai_user' };

  const match = await Match.findById(matchId).lean();
  if (!match || match.status !== 'finished') return { queued: false, reason: 'not_finished' };

  const prediction = await Prediction.findOne({ userId: aiUser._id, matchId: match._id }).lean();
  if (!prediction || prediction.pointsEarned == null) {
    return { queued: false, reason: 'no_scored_prediction' };
  }

  const scoreKey = matchResultScoreKey(match);
  const review = prediction.aiPostMatchReview;
  if (review?.analysis?.trim() && review.resultScoreKey === scoreKey) {
    return { queued: false, reason: 'already_generated' };
  }

  await getOrGenerateAiPostMatchReview(matchId, { refresh: Boolean(review?.analysis) });
  return { queued: true };
}
