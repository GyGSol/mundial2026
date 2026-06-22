/**
 * Reglas operativas de clima para partidos en vivo (protocolo NOAA 8 mi / 30 min en sedes USA).
 *
 * Escenario A — Kickoff pasó, partido no inició (tormenta):
 *   - Sin weatherOps: promoteMatchesAtKickoff pasa a `live` con 0-0 (falso positivo).
 *   - Con pre_kickoff_delay: status queda `upcoming`, predicciones bloqueadas, sin puntos provisionales.
 *
 * Escenario B — Partido en curso suspendido por rayos:
 *   - status sigue `live`; weatherOps.phase = `suspended`.
 *   - Puntos provisionales congelados (marcador no avanza sin goles).
 *   - UI muestra suspensión + resumeEarliestAt (30 min desde última alerta).
 *
 * Escenario C — Postergación pre-kickoff (nuevo horario):
 *   - weatherOps.phase = `postponed` o `pre_kickoff_delay`; kickoffAt actualizado.
 *   - originalKickoffAt preserva el horario FIFA original.
 *   - Predicciones se reabren si nuevo kickoff deja lockAt en el futuro.
 *
 * Escenario D — Solapamiento / parejas de grupo simultáneas:
 *   - Varios partidos `live` es válido; liveScheduleContext advierte desbalance de grupo.
 */

export const WEATHER_OPS_PHASES = ['normal', 'pre_kickoff_delay', 'suspended', 'postponed'];

export const WEATHER_OPS_REASONS = ['lightning', 'severe_weather', 'heat', 'other'];

export const NOAA_RESUME_WAIT_MS = 30 * 60 * 1000;

export const DEFAULT_WEATHER_OPS = {
  phase: 'normal',
  reason: null,
  protocol: null,
  since: null,
  resumeEarliestAt: null,
  originalKickoffAt: null,
  delayedKickoffAt: null,
  lastAlertAt: null,
  nwsAlertId: null,
  source: null,
  overlapGroupKey: null,
};

export function normalizeWeatherOps(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_WEATHER_OPS };
  }
  const phase = WEATHER_OPS_PHASES.includes(raw.phase) ? raw.phase : 'normal';
  return {
    phase,
    reason: WEATHER_OPS_REASONS.includes(raw.reason) ? raw.reason : raw.reason ?? null,
    protocol: raw.protocol ?? null,
    since: raw.since ? new Date(raw.since) : null,
    resumeEarliestAt: raw.resumeEarliestAt ? new Date(raw.resumeEarliestAt) : null,
    originalKickoffAt: raw.originalKickoffAt ? new Date(raw.originalKickoffAt) : null,
    delayedKickoffAt: raw.delayedKickoffAt ? new Date(raw.delayedKickoffAt) : null,
    lastAlertAt: raw.lastAlertAt ? new Date(raw.lastAlertAt) : null,
    nwsAlertId: raw.nwsAlertId ?? null,
    source: raw.source ?? null,
    overlapGroupKey: raw.overlapGroupKey ?? null,
  };
}

export function serializeWeatherOpsForClient(ops) {
  const normalized = normalizeWeatherOps(ops);
  if (normalized.phase === 'normal') {
    return { phase: 'normal' };
  }
  return {
    phase: normalized.phase,
    reason: normalized.reason,
    protocol: normalized.protocol,
    since: normalized.since?.toISOString?.() ?? null,
    resumeEarliestAt: normalized.resumeEarliestAt?.toISOString?.() ?? null,
    originalKickoffAt: normalized.originalKickoffAt?.toISOString?.() ?? null,
    delayedKickoffAt: normalized.delayedKickoffAt?.toISOString?.() ?? null,
    lastAlertAt: normalized.lastAlertAt?.toISOString?.() ?? null,
    nwsAlertId: normalized.nwsAlertId,
    source: normalized.source,
    overlapGroupKey: normalized.overlapGroupKey,
  };
}

/** Bloquea promoción automática a live en kickoff. */
export function blocksKickoffPromotion(ops) {
  const phase = normalizeWeatherOps(ops).phase;
  return phase === 'pre_kickoff_delay' || phase === 'postponed';
}

/** La ventana NOAA de 30 min ya venció; el partido puede arrancar. */
export function isPreKickoffDelayExpired(ops, now = Date.now()) {
  const normalized = normalizeWeatherOps(ops);
  if (normalized.phase !== 'pre_kickoff_delay') return false;
  if (!normalized.resumeEarliestAt) return false;
  return normalized.resumeEarliestAt.getTime() <= now;
}

/** Ventana de reanudación cumplida tras suspensión en vivo (Escenario B). */
export function isWeatherSuspensionExpired(ops, now = Date.now()) {
  const normalized = normalizeWeatherOps(ops);
  if (normalized.phase !== 'suspended') return false;
  if (!normalized.resumeEarliestAt) return false;
  return normalized.resumeEarliestAt.getTime() <= now;
}

export function clearWeatherOpsToNormal() {
  return { ...DEFAULT_WEATHER_OPS };
}

/** Partido en vivo pero con reloj detenido por clima (overlay sobre status=live). */
export function isWeatherSuspendedLive(match) {
  return match?.status === 'live' && normalizeWeatherOps(match.weatherOps).phase === 'suspended';
}

/** Puntos provisionales activos solo si live y no es demora pre-kickoff. */
export function allowsProvisionalScoring(match) {
  if (match?.status !== 'live') return match?.status === 'finished';
  const phase = normalizeWeatherOps(match.weatherOps).phase;
  return phase !== 'pre_kickoff_delay';
}

export function computeResumeEarliestAt(lastAlertAt, now = Date.now()) {
  const base = lastAlertAt ? new Date(lastAlertAt).getTime() : now;
  return new Date(Math.max(now, base + NOAA_RESUME_WAIT_MS));
}
