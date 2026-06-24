import { REALTIME_EVENTS, isLiveMatchReason } from './realtimeSectors.js';
import { mergeLiveSnapshot } from './patchLiveMatchSnapshot.js';

/** Reasons donde cambian ranking, baseline o flechas de stats — hace falta refetch del dashboard. */
export const FULL_DASHBOARD_MATCH_REASONS = new Set([
  'kickoff_live',
  'stale_live_finalized',
  'simulation_finished',
  'simulation_live',
  'recent_finished_fifa_refresh',
  'premature_finish_reopened',
  'weather_pre_kickoff_delay',
  'admin_match_update',
]);

function dashboardNeedsLeaderboardRefresh(data) {
  const hasLiveBar =
    (data?.liveMatches?.length ?? 0) > 0 || (data?.recentFinishedMatches?.length ?? 0) > 0;
  const hasBaseline = (data?.leaderboardKickoffBaseline?.length ?? 0) > 0;
  const hasIndicators = (data?.leaderboardLiveStatIndicators?.liveMatchIds?.length ?? 0) > 0;
  return hasLiveBar && !hasBaseline && !hasIndicators;
}

/**
 * Parchea live/recent desde snapshot en lugar de refetch completo.
 * @returns {boolean} true si consumió el evento (skip refresh)
 */
export function handleLiveSnapshotRealtime(msg, { patchData, fetchSnapshot, getData }) {
  if (msg?.type !== REALTIME_EVENTS.MATCHES_UPDATED) return false;
  if (!isLiveMatchReason(msg.reason)) return false;
  if (typeof patchData !== 'function' || typeof fetchSnapshot !== 'function') return false;

  if (FULL_DASHBOARD_MATCH_REASONS.has(msg.reason)) return false;
  if (typeof getData === 'function' && dashboardNeedsLeaderboardRefresh(getData())) return false;

  void fetchSnapshot()
    .then((snapshot) => {
      if (!snapshot) return;
      patchData((prev) => mergeLiveSnapshot(prev, snapshot));
    })
    .catch(() => {});

  return true;
}
