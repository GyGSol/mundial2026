import { Match } from '../models/Match.js';
import { env } from '../config/env.js';
import { isMatchActivelyLive } from './matchStatusRules.js';

/** A partir de cuántos partidos activamente en vivo se usa la cadencia conservadora (multi-live). */
export const SCHEDULE_PRESSURE_LIVE_THRESHOLD = 2;

function readMs(envKey, fallbackMs) {
  const raw = process.env[envKey];
  if (raw != null && raw !== '') {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return fallbackMs;
}

/** Intervalos según cantidad de partidos en vivo activos (sin tocar la DB). */
export function resolveLiveSyncCadence(activeLiveCount, now = Date.now()) {
  void now;
  const relaxed = activeLiveCount < SCHEDULE_PRESSURE_LIVE_THRESHOLD;

  if (relaxed) {
    return {
      activeLiveCount,
      hasSchedulePressure: false,
      liveFifaRefreshMs: readMs('LIVE_FIFA_REFRESH_SINGLE_MS', 8_000),
      kickoffWatchLiveMs: readMs('KICKOFF_WATCH_SINGLE_MS', 8_000),
      syncIntervalLiveMs: readMs('SYNC_INTERVAL_SINGLE_LIVE_MS', 10_000),
      dashboardCacheLiveTtlMs: readMs('DASHBOARD_CACHE_SINGLE_LIVE_MS', 5_000),
    };
  }

  return {
    activeLiveCount,
    hasSchedulePressure: true,
    liveFifaRefreshMs: env.liveFifaRefreshMs,
    kickoffWatchLiveMs: env.kickoffWatchLiveMs,
    syncIntervalLiveMs: env.syncIntervalLiveMs,
    dashboardCacheLiveTtlMs: 10_000,
  };
}

/** Cuenta partidos en vivo activos y devuelve intervalos recomendados. */
export async function getLiveSyncCadence(now = Date.now()) {
  const liveMatches = await Match.find({ status: 'live' })
    .select('kickoffAt status weatherOps homeScore awayScore')
    .lean();
  const activeLiveCount = liveMatches.filter((match) => isMatchActivelyLive(match, now)).length;
  const count = activeLiveCount > 0 ? activeLiveCount : liveMatches.length;
  return resolveLiveSyncCadence(count, now);
}
