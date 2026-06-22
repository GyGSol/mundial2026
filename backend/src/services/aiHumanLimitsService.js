import { env } from '../config/env.js';
import { AiHumanUsage } from '../models/AiHumanUsage.js';
import { User } from '../models/User.js';

export const AI_HUMAN_USAGE_KINDS = ['insight', 'question', 'playerIntel'];

function utcDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function utcHourKey(date = new Date()) {
  return date.toISOString().slice(0, 13);
}

function limitForKind(kind) {
  if (kind === 'insight') return env.aiHumanInsightDailyLimit;
  if (kind === 'question') return env.aiHumanQuestionDailyLimit;
  if (kind === 'playerIntel') return env.aiHumanPlayerIntelDailyLimit;
  return env.aiHumanHourlyLimit;
}

export function createHumanAiLimitError(message, { retryAfterSec = 3600 } = {}) {
  const error = new Error(message);
  error.status = 429;
  error.code = 'ai_rate_limit';
  error.retryAfterSec = retryAfterSec;
  return error;
}

export async function isHumanAiExempt(userId) {
  const user = await User.findById(userId).select('isAiUser').lean();
  return Boolean(user?.isAiUser);
}

/**
 * Reserva cupo de IA humana (insight / pregunta / intel jugador).
 * Idempotente por request: incrementa contadores atómicamente.
 */
export async function consumeHumanAiSlot(userId, kind, { now = new Date() } = {}) {
  if (!env.aiHumanLimitsEnabled) {
    return { allowed: true, exempt: false, remaining: null };
  }
  if (!AI_HUMAN_USAGE_KINDS.includes(kind)) {
    throw new Error(`Tipo de uso IA inválido: ${kind}`);
  }

  if (await isHumanAiExempt(userId)) {
    return { allowed: true, exempt: true, remaining: null };
  }

  const dayKey = utcDayKey(now);
  const hourKey = utcHourKey(now);
  const dayLimit = limitForKind(kind);
  const hourLimit = env.aiHumanHourlyLimit;

  const dayField = kind === 'playerIntel' ? 'playerIntel' : kind;
  const dayDoc = await AiHumanUsage.findOneAndUpdate(
    { userId, scope: 'day', bucket: dayKey },
    { $inc: { [dayField]: 1, total: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  const dayUsed = dayDoc?.[dayField] ?? 1;
  if (dayUsed > dayLimit) {
    await AiHumanUsage.updateOne(
      { userId, scope: 'day', bucket: dayKey },
      { $inc: { [dayField]: -1, total: -1 } }
    );
    throw createHumanAiLimitError(
      `Límite diario de consultas IA alcanzado (${dayLimit}/${kind}). Volvé mañana o usá otro proveedor cuando esté disponible.`,
      { retryAfterSec: secondsUntilUtcDayEnd(now) }
    );
  }

  const hourDoc = await AiHumanUsage.findOneAndUpdate(
    { userId, scope: 'hour', bucket: hourKey },
    { $inc: { total: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  const hourUsed = hourDoc?.total ?? 1;
  if (hourUsed > hourLimit) {
    await AiHumanUsage.updateOne(
      { userId, scope: 'day', bucket: dayKey },
      { $inc: { [dayField]: -1, total: -1 } }
    );
    await AiHumanUsage.updateOne(
      { userId, scope: 'hour', bucket: hourKey },
      { $inc: { total: -1 } }
    );
    throw createHumanAiLimitError(
      `Demasiadas consultas IA en la última hora (máx. ${hourLimit}). Esperá unos minutos.`,
      { retryAfterSec: secondsUntilUtcHourEnd(now) }
    );
  }

  return {
    allowed: true,
    exempt: false,
    remaining: {
      daily: Math.max(0, dayLimit - dayUsed),
      hourly: Math.max(0, hourLimit - hourUsed),
    },
  };
}

function secondsUntilUtcDayEnd(now) {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return Math.max(60, Math.ceil((end - now) / 1000));
}

function secondsUntilUtcHourEnd(now) {
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours() + 1)
  );
  return Math.max(60, Math.ceil((end - now) / 1000));
}

export async function getHumanAiUsageSummary(userId, { now = new Date() } = {}) {
  if (await isHumanAiExempt(userId)) {
    return { exempt: true, limits: null, used: null };
  }

  const dayKey = utcDayKey(now);
  const hourKey = utcHourKey(now);
  const [dayDoc, hourDoc] = await Promise.all([
    AiHumanUsage.findOne({ userId, scope: 'day', bucket: dayKey }).lean(),
    AiHumanUsage.findOne({ userId, scope: 'hour', bucket: hourKey }).lean(),
  ]);

  return {
    exempt: false,
    limits: {
      insightDaily: env.aiHumanInsightDailyLimit,
      questionDaily: env.aiHumanQuestionDailyLimit,
      playerIntelDaily: env.aiHumanPlayerIntelDailyLimit,
      hourlyTotal: env.aiHumanHourlyLimit,
    },
    used: {
      insight: dayDoc?.insight ?? 0,
      question: dayDoc?.question ?? 0,
      playerIntel: dayDoc?.playerIntel ?? 0,
      hourlyTotal: hourDoc?.total ?? 0,
    },
  };
}
