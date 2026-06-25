import { env } from '../config/env.js';

/**
 * Horario de predicción automática del competidor IA (job cada ~60 s).
 * Ventana principal: kickoff − lead ± window (default T−1 h ± 2 min).
 */
export function getAiAutoPredictionSchedule(kickoffAt, now = Date.now()) {
  if (!kickoffAt) return null;
  const kickoffMs = new Date(kickoffAt).getTime();
  if (!Number.isFinite(kickoffMs)) return null;

  const lead = env.aiPredictLeadMs;
  const window = env.aiPredictWindowMs;
  const targetMs = kickoffMs - lead;
  const windowStartMs = kickoffMs - lead - window;
  const windowEndMs = kickoffMs - lead + window;
  const nowMs = typeof now === 'number' ? now : now.getTime();

  let phase = 'scheduled';
  if (nowMs >= windowStartMs && nowMs <= windowEndMs) {
    phase = 'in_window';
  } else if (nowMs > windowEndMs && nowMs < kickoffMs) {
    phase = 'catchup';
  } else if (nowMs >= kickoffMs) {
    phase = 'past_kickoff';
  }

  return {
    targetAt: new Date(targetMs).toISOString(),
    windowStartAt: new Date(windowStartMs).toISOString(),
    windowEndAt: new Date(windowEndMs).toISOString(),
    leadMinutes: Math.round(lead / 60_000),
    windowMinutes: Math.round(window / 60_000),
    phase,
  };
}
