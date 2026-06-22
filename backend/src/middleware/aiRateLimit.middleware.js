import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

/** Capa HTTP anti-abuso (complementa límites por usuario en aiHumanLimitsService). */
export function createAiBurstLimiter({ windowMs = 60_000, max = 20 } = {}) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => String(req.user?._id ?? req.ip ?? 'anon'),
    message: {
      error: 'Demasiadas solicitudes IA. Esperá un momento.',
      code: 'ai_burst_limit',
    },
    skip: () => env.appEnv !== 'production' && process.env.AI_BURST_LIMIT_DISABLED === '1',
  });
}

export const aiConsultationBurstLimiter = createAiBurstLimiter({
  windowMs: Number(process.env.AI_BURST_WINDOW_MS || 60_000),
  max: Number(process.env.AI_BURST_MAX_PER_MIN || 20),
});
