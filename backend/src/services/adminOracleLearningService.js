import mongoose from 'mongoose';
import { AiCompetitorPredictionLog } from '../models/AiCompetitorPredictionLog.js';
import {
  aiModelForScoreSource,
  callAiForText,
  getAiUser,
  hasAiProvider,
  WORLD_CUP_MATCH_ANALYSIS_INSTRUCTIONS,
} from './aiPredictionService.js';
import {
  buildCalibrationPromptBlock,
  loadAiCalibrationStats,
} from './aiPredictionCalibrationService.js';
import {
  exportTrainingBufferRecords,
  getTrainingBufferSummary,
  listTrainingBufferRows,
} from './trainingBufferService.js';
import {
  humanizeCompetitorPromptContext,
  WORLD_CUP_USER_FACING_LANGUAGE_RULES,
} from './aiPromptHumanizer.js';

export const ADMIN_ORACLE_QUESTION_MAX_LEN = 2000;
const ADMIN_MESSAGES_STORED_MAX = 80;
const ADMIN_HISTORY_FOR_PROMPT = 16;

function trimMessages(messages = []) {
  return messages.slice(-ADMIN_MESSAGES_STORED_MAX);
}

function historyForPrompt(log) {
  return (log.adminReviewMessages ?? [])
    .filter((entry) => entry.content?.trim())
    .slice(-ADMIN_HISTORY_FOR_PROMPT)
    .map((entry) => ({
      role: entry.role,
      content: entry.content,
    }));
}

function formatReviewThread(log) {
  if (!log) return null;
  return {
    logId: log._id?.toString?.() ?? log.id,
    matchId: log.matchId?.toString?.() ?? null,
    correctedReasoning: log.correctedReasoning ?? '',
    adminNotes: log.adminNotes ?? '',
    messages: (log.adminReviewMessages ?? []).map((msg) => ({
      id: msg._id?.toString?.(),
      role: msg.role,
      content: msg.content,
      source: msg.source ?? null,
      model: msg.model ?? null,
      createdAt: msg.createdAt,
    })),
  };
}

async function loadOfficialLog(logId) {
  if (!mongoose.Types.ObjectId.isValid(logId)) {
    const error = new Error('Log no encontrado');
    error.status = 404;
    throw error;
  }

  const log = await AiCompetitorPredictionLog.findById(logId).lean();
  if (!log) {
    const error = new Error('Log no encontrado');
    error.status = 404;
    throw error;
  }
  return log;
}

function buildAdminOraclePrompt(log, question) {
  const history = historyForPrompt(log);
  const historyBlock = history.length
    ? `\nConversación previa con el admin:\n${history
        .map((entry) => `${entry.role === 'user' ? 'Admin' : 'Oracle'}: ${entry.content}`)
        .join('\n')}\n`
    : '';

  const contextPayload = log.promptContext
    ? humanizeCompetitorPromptContext(log.promptContext)
    : null;

  const correctionBlock = [log.correctedReasoning, log.adminNotes]
    .map((v) => String(v ?? '').trim())
    .filter(Boolean)
    .join('\n\n');

  return `Sos el analista Oracle del competidor IA "Predictive Modeling" en el Mundial FIFA 2026.

${WORLD_CUP_MATCH_ANALYSIS_INSTRUCTIONS}

Tu rol en este panel admin:
- Revisar el contexto usado para la predicción y explicar qué variables pesaron más.
- Detectar alucinaciones (datos inventados, jugadores inexistentes, clima o ranking falso).
- Proponer correcciones concretas al razonamiento y al prompt de entrenamiento.
- Ser honesto cuando falte información en el contexto.

${WORLD_CUP_USER_FACING_LANGUAGE_RULES}

Predicción del modelo: ${log.homeGoals}-${log.awayGoals}
Fuente: ${log.aiSource ?? 'desconocida'} · Modelo: ${log.aiModel ?? '—'}
Calibración aplicada: ${log.calibrationApplied ? 'sí' : 'no'}

Contexto enviado al modelo:
${contextPayload ? JSON.stringify(contextPayload, null, 2) : 'Sin contexto guardado'}

Respuesta cruda:
${log.rawResponse ? JSON.stringify(log.rawResponse, null, 2) : 'Sin respuesta cruda'}

Respuesta final (post-calibración):
${log.finalResponse ? JSON.stringify(log.finalResponse, null, 2) : 'Sin respuesta final'}

${correctionBlock ? `Correcciones / notas del admin:\n${correctionBlock}\n` : ''}
${historyBlock}
Pregunta del admin: ${question}

Respondé en español, claro y accionable. Usá markdown ligero (listas, negritas). Si detectás alucinación, marcala explícitamente y sugerí qué dato del contexto debió usarse.`;
}

export async function getAdminLearningOverview() {
  const aiUser = await getAiUser();
  const calibration = aiUser
    ? await loadAiCalibrationStats(aiUser._id)
    : {
        partidosAnalizados: 0,
        errorCombinado: null,
        nota: 'Usuario IA no configurado',
        puedeAjustar: false,
      };

  const [training, recentRows] = await Promise.all([
    getTrainingBufferSummary(),
    listTrainingBufferRows({ limit: 8, onlyUnexported: false }),
  ]);

  return {
    hasAiProvider: hasAiProvider(),
    aiUserEmail: aiUser?.email ?? null,
    calibration,
    calibrationPrompt: buildCalibrationPromptBlock(calibration),
    training,
    recentTrainingRows: recentRows,
  };
}

export async function getAdminOracleReviewThread(logId) {
  const log = await loadOfficialLog(logId);
  return formatReviewThread(log);
}

export async function askAdminOracleReview(logId, question, { fetchImpl = fetch } = {}) {
  if (!hasAiProvider()) throw new Error('IA no configurada');

  const trimmed = String(question ?? '').trim();
  if (!trimmed) throw new Error('Escribí una pregunta');
  if (trimmed.length > ADMIN_ORACLE_QUESTION_MAX_LEN) {
    throw new Error('La pregunta es demasiado larga');
  }

  const log = await loadOfficialLog(logId);
  const prompt = buildAdminOraclePrompt(log, trimmed);
  const answer = await callAiForText(prompt, { fetchImpl });
  if (!answer?.text) throw new Error('La IA no devolvió respuesta');

  const now = new Date();
  const messages = trimMessages([
    ...(log.adminReviewMessages ?? []),
    { role: 'user', content: trimmed, createdAt: now },
    {
      role: 'assistant',
      content: answer.text,
      source: answer.source ?? null,
      model: aiModelForScoreSource(answer.source),
      createdAt: new Date(),
    },
  ]);

  const updated = await AiCompetitorPredictionLog.findByIdAndUpdate(
    logId,
    { $set: { adminReviewMessages: messages } },
    { new: true }
  ).lean();

  return formatReviewThread(updated);
}

export async function clearAdminOracleReview(logId) {
  await loadOfficialLog(logId);
  const updated = await AiCompetitorPredictionLog.findByIdAndUpdate(
    logId,
    { $set: { adminReviewMessages: [] } },
    { new: true }
  ).lean();
  return formatReviewThread(updated);
}

export async function exportTrainingBufferForAdmin({ writeFile = false } = {}) {
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const outDir = writeFile
    ? path.join(__dirname, '../../../training/data/buffer')
    : null;

  return exportTrainingBufferRecords({ writeFile, outDir });
}
