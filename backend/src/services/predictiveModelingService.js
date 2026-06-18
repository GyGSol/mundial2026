import Cerebras from '@cerebras/cerebras_cloud_sdk';
import { Match } from '../models/Match.js';
import { Prediction } from '../models/Prediction.js';
import { env } from '../config/env.js';
import { ORACLE_RESPONSE_FORMAT } from '../schemas/oraclePredictionSchema.js';
import {
  AI_COMPETITOR_SCORING_INSTRUCTIONS,
  WORLD_CUP_MATCH_ANALYSIS_INSTRUCTIONS,
  clampGoals,
  getAiUser,
  parseGeminiJsonResponse,
} from './aiPredictionService.js';
import {
  humanizeCompetitorPromptContext,
  sanitizeAiUserFacingText,
  WORLD_CUP_USER_FACING_LANGUAGE_RULES,
} from './aiPromptHumanizer.js';

const SOURCE = 'cerebras-oracle';
const liveAdjustmentCache = new Map();

/** Instrucciones exclusivas del esquema Oracle (razonamiento largo + jerarquía de señales). */
export const ORACLE_REASONING_INSTRUCTIONS = `RAZONAMIENTO ORACLE (campos reasoning y key_variable_impact):
- "reasoning": explicación COMPLETA en español (mínimo 3 oraciones o 3 viñetas). Markdown ligero permitido (**negritas**, listas).
- Si sedeYClima.resumenLinea está disponible: incluila al inicio del reasoning (Estadio + Clima en tiempo real, mismo formato que panel Predicciones).
- En partido en vivo citá sedeYClima.climaActualEnSede; si es próximo, sedeYClima.pronosticoAlKickoff (y opcionalmente clima actual). No inventes clima si sedeYClima.disponible=false.
- Si mundial2026.lecturaTorneo2026 indica primer partido o PJ=0: decilo explícitamente. PROHIBIDO afirmar que "llegan sin anotar en fase de grupos" o que "empataron sin goles" si aún no jugaron en 2026.
- Con primer partido del grupo, citá al menos DOS señales de: historialReciente.preTorneo, clasificacionYMundiales, enfrentamientosDirectosHistoricos, worldCupHistory/wikiRecords, plantilla o clima de sede.
- Si ya hay PJ>0 en 2026, citá forma/goles/tabla/H2H del torneo actual.
- El ranking FIFA NO puede ser el factor principal ni la única justificación. Usalo solo como desempate fino.
- "key_variable_impact": UNA frase con el factor más determinante que NO sea solo "ranking FIFA".
- El marcador debe seguir guiaPrioridadContexto; con PJ=0 priorizá pre-torneo y clasificación, no inventes puntos o posiciones en tabla 2026.`;

let cerebrasClient = null;

function getCerebrasClient() {
  if (!env.cerebrasApiKey) return null;
  if (!cerebrasClient) {
    cerebrasClient = new Cerebras({ apiKey: env.cerebrasApiKey });
  }
  return cerebrasClient;
}

function buildOracleCompetitorPrompt(context, { liveState = null } = {}) {
  const liveBlock = liveState
    ? `\nESTADO EN VIVO (ajustá la predicción restante del partido, no el resultado a 90 min desde cero sin contexto):
Marcador actual: ${liveState.homeScore}-${liveState.awayScore}
Minuto: ${liveState.minute ?? 'desconocido'}
`
    : '';

  return `Sos Predictive Modeling (Oracle), competidor oficial del Mundial 2026. Predecí el marcador final que maximice puntos y minimice error (Gdif → 0).

${WORLD_CUP_MATCH_ANALYSIS_INSTRUCTIONS}

${AI_COMPETITOR_SCORING_INSTRUCTIONS}

${WORLD_CUP_USER_FACING_LANGUAGE_RULES}

${ORACLE_REASONING_INSTRUCTIONS}
${liveBlock}
Respondé con el esquema JSON estricto:
- home_goals / away_goals: enteros 0-10
- confidence_interval: 0-1 (certeza del marcador)
- reasoning: explicación completa en español (3-6 oraciones o lista; ver reglas arriba)
- key_variable_impact: factor más determinante en una frase (no solo ranking FIFA)
- error_reduction_factor: 0-1 estimación de reducción de error vs baseline

Contexto del partido:
${JSON.stringify(humanizeCompetitorPromptContext(context), null, 2)}`;
}

export function parseOracleStructuredResponse(raw) {
  const parsed = typeof raw === 'string' ? parseGeminiJsonResponse(raw) : raw;
  if (!parsed || typeof parsed !== 'object') return null;

  let homeRaw = parsed.home_goals ?? parsed.homeGoals;
  let awayRaw = parsed.away_goals ?? parsed.awayGoals;
  if (homeRaw == null && awayRaw == null && Array.isArray(parsed.predicted_score)) {
    homeRaw = parsed.predicted_score[0];
    awayRaw = parsed.predicted_score[1];
  }

  const homeGoals = clampGoals(homeRaw);
  const awayGoals = clampGoals(awayRaw);
  if (homeGoals === null || awayGoals === null) return null;

  const confidence = Number(parsed.confidence_interval);
  const errorReduction = Number(parsed.error_reduction_factor);

  const keyImpact = String(parsed.key_variable_impact ?? '').trim();
  const reasoningRaw = String(parsed.reasoning ?? '').trim();
  const reasoning = sanitizeAiUserFacingText(
    reasoningRaw || keyImpact
  );
  const keyVariable = sanitizeAiUserFacingText(keyImpact || reasoningRaw);

  return {
    homeGoals,
    awayGoals,
    reasoning,
    source: SOURCE,
    oracle: {
      predicted_score: [homeGoals, awayGoals],
      confidence_interval: Number.isFinite(confidence)
        ? Math.min(1, Math.max(0, confidence))
        : null,
      reasoning,
      key_variable_impact: keyVariable,
      error_reduction_factor: Number.isFinite(errorReduction)
        ? Math.min(1, Math.max(0, errorReduction))
        : null,
    },
  };
}

function oracleToLegacyScore(oracleResult) {
  if (!oracleResult) return null;
  return {
    homeGoals: oracleResult.homeGoals,
    awayGoals: oracleResult.awayGoals,
    reasoning: oracleResult.reasoning,
    source: oracleResult.source,
    oracle: oracleResult.oracle,
  };
}

async function callCerebrasOracle(context, { liveState = null, client = getCerebrasClient() } = {}) {
  if (!client) return null;

  const useStructured = env.oracleStructuredOutput !== false;
  const messages = [{ role: 'user', content: buildOracleCompetitorPrompt(context, { liveState }) }];

  const request = {
    model: env.aiCerebrasModel,
    messages,
    temperature: 0.35,
  };

  if (useStructured) {
    request.response_format = ORACLE_RESPONSE_FORMAT;
  } else {
    request.response_format = { type: 'json_object' };
  }

  const completion = await client.chat.completions.create(request);
  const text = String(completion?.choices?.[0]?.message?.content ?? '').trim();
  if (!text) return null;

  const oracleParsed = parseOracleStructuredResponse(text);
  if (oracleParsed) return oracleParsed;

  const legacy = parseGeminiJsonResponse(text);
  if (legacy?.homeGoals != null && legacy?.awayGoals != null) {
    return {
      homeGoals: clampGoals(legacy.homeGoals) ?? 1,
      awayGoals: clampGoals(legacy.awayGoals) ?? 1,
      reasoning: sanitizeAiUserFacingText(String(legacy.reasoning ?? '').trim()),
      source: SOURCE,
      oracle: null,
    };
  }

  return null;
}

/** Único punto de inferencia Oracle para marcadores del competidor IA. */
export async function predictScore(context, options = {}) {
  if (!env.cerebrasApiKey) return null;

  try {
    const result = await callCerebrasOracle(context, options);
    if (result) return oracleToLegacyScore(result);
  } catch (err) {
    console.warn('Oracle predictScore failed:', err?.message ?? err);
  }

  return null;
}

function liveCacheKey(matchId, homeScore, awayScore) {
  return `${matchId}:${homeScore}-${awayScore}`;
}

/** Ajuste ligero en vivo cuando cambia el marcador (debounce por env). */
export async function predictLiveAdjustment(matchId, liveState = {}) {
  if (!env.cerebrasApiKey || env.oracleLiveAdjustmentMs <= 0) {
    return { adjusted: false, reason: 'disabled' };
  }

  const aiUser = await getAiUser();
  if (!aiUser) return { adjusted: false, reason: 'no_ai_user' };

  const match = await Match.findById(matchId).lean();
  if (!match || match.status !== 'live') {
    return { adjusted: false, reason: 'not_live' };
  }

  const homeScore = liveState.homeScore ?? match.homeScore ?? 0;
  const awayScore = liveState.awayScore ?? match.awayScore ?? 0;
  const cacheKey = liveCacheKey(matchId, homeScore, awayScore);
  const now = Date.now();
  const cached = liveAdjustmentCache.get(cacheKey);
  if (cached && now - cached.at < env.oracleLiveAdjustmentMs) {
    return { adjusted: false, reason: 'debounced', last: cached.result };
  }

  const prediction = await Prediction.findOne({
    userId: aiUser._id,
    matchId: match._id,
    predictionSource: 'ai',
  }).lean();
  if (!prediction) return { adjusted: false, reason: 'no_prediction' };

  const { buildAiCompetitorPredictionContext } = await import('./aiPredictionService.js');
  const context = await buildAiCompetitorPredictionContext(match, aiUser._id);

  const minute =
    liveState.minute ??
    match.raw?.time_elapsed ??
    match.raw?.timeElapsed ??
    null;

  let result;
  try {
    result = await callCerebrasOracle(context, {
      liveState: { homeScore, awayScore, minute },
    });
  } catch (err) {
    console.warn(`Oracle live adjustment failed (${match.externalId}):`, err?.message ?? err);
    return { adjusted: false, reason: 'api_error' };
  }

  if (!result) return { adjusted: false, reason: 'empty_response' };

  const payload = oracleToLegacyScore(result);
  liveAdjustmentCache.set(cacheKey, { at: now, result: payload });

  return {
    adjusted: true,
    suggestion: payload,
    currentPrediction: {
      homeGoals: prediction.homeGoals,
      awayGoals: prediction.awayGoals,
    },
    liveScore: { home: homeScore, away: awayScore },
  };
}

export function resetLiveAdjustmentCacheForTests() {
  liveAdjustmentCache.clear();
}
