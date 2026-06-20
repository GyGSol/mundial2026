/** Tipos de evento WebSocket que emite el backend. */
export const REALTIME_EVENTS = {
  MATCHES_UPDATED: 'matches:updated',
  LEADERBOARD_UPDATED: 'leaderboard:updated',
  SYNC_COMPLETE: 'sync:complete',
  PLAYERS_UPDATED: 'players:updated',
};

export const ALL_REALTIME_EVENTS = Object.values(REALTIME_EVENTS);

/** Tags de sector para documentar consumidores de useLiveData. */
export const SECTOR_TAGS = {
  RANKING_DASHBOARD: 'ranking:dashboard',
  RANKING_ARCHIVE: 'ranking:archive',
  RANKING_ELIMINATION: 'ranking:elimination',
  PREDICTIONS_MATCHES: 'predictions:matches',
  PREDICTIONS_STANDINGS: 'predictions:standings',
  WORLDCUP_OVERVIEW: 'worldcup:overview',
  WORLDCUP_PLAYERS: 'worldcup:players',
  WORLDCUP_DATACENTER: 'worldcup:datacenter',
  WORLDCUP_AI_BRIEFING: 'worldcup:ai-briefing',
  TRANSMISSIONS_TODAY: 'transmissions:today',
  ADMIN_STATS: 'admin:stats',
  ADMIN_MATCHES: 'admin:matches',
  ADMIN_PREDICTIONS: 'admin:predictions',
  ADMIN_USERS_LOOKUP: 'admin:users-lookup',
  ADMIN_MATCHES_LOOKUP: 'admin:matches-lookup',
  ADMIN_SIMULATION: 'admin:simulation',
  ADMIN_SYNC: 'admin:sync',
  ADMIN_STREAMS: 'admin:streams',
  ADMIN_STREAMS_TODAY: 'admin:streams-today',
  ADMIN_GROUPS: 'admin:groups',
  ADMIN_USERS: 'admin:users',
  ADMIN_AI_OVERVIEW: 'admin:ai-overview',
  ADMIN_AI_ANALYTICS: 'admin:ai-analytics',
};

/** Reasons de matches:updated que solo afectan marcador/estado en vivo. */
export const LIVE_MATCH_REASONS = new Set([
  'live_scoring_sync',
  'kickoff_live',
  'stale_live_finalized',
  'premature_finish_reopened',
  'recent_finished_fifa_refresh',
  'weather_pre_kickoff_delay',
  'simulation_live',
  'simulation_finished',
  'admin_match_update',
]);

export const LEADERBOARD_REASONS = new Set([
  'live_scores_updated',
  'scores_recalculated',
  'live_baseline',
  'scores_cleared',
  'kickoff_live',
  'sync_complete',
  'admin_prediction_created',
  'admin_prediction_updated',
  'admin_ai_competitor_prediction',
  'simulation_live',
  'simulation_finished',
  'simulation_setup',
  'simulation_reset',
  'recent_finished_fifa_refresh',
  'stale_live_finalized',
]);

export const SIMULATION_REASONS_PREFIX = 'simulation_';

export function isLiveMatchReason(reason) {
  return Boolean(reason && LIVE_MATCH_REASONS.has(reason));
}

export function isSimulationReason(reason) {
  return Boolean(reason && String(reason).startsWith(SIMULATION_REASONS_PREFIX));
}

/**
 * @param {string} sectorTag
 * @param {{ type?: string, reason?: string }} msg
 * @returns {boolean}
 */
export function shouldRefreshSector(sectorTag, msg) {
  const type = msg?.type ?? '';

  switch (sectorTag) {
    case SECTOR_TAGS.RANKING_DASHBOARD:
      return type === REALTIME_EVENTS.LEADERBOARD_UPDATED || type === REALTIME_EVENTS.SYNC_COMPLETE;
    case SECTOR_TAGS.PREDICTIONS_MATCHES:
      return type === REALTIME_EVENTS.MATCHES_UPDATED;
    case SECTOR_TAGS.PREDICTIONS_STANDINGS:
      return type === REALTIME_EVENTS.LEADERBOARD_UPDATED;
    case SECTOR_TAGS.WORLDCUP_OVERVIEW:
      return type === REALTIME_EVENTS.MATCHES_UPDATED || type === REALTIME_EVENTS.SYNC_COMPLETE;
    case SECTOR_TAGS.WORLDCUP_PLAYERS:
      return type === REALTIME_EVENTS.PLAYERS_UPDATED;
    case SECTOR_TAGS.WORLDCUP_DATACENTER:
    case SECTOR_TAGS.ADMIN_GROUPS:
    case SECTOR_TAGS.ADMIN_USERS:
    case SECTOR_TAGS.ADMIN_AI_ANALYTICS:
      return false;
    case SECTOR_TAGS.TRANSMISSIONS_TODAY:
    case SECTOR_TAGS.ADMIN_MATCHES:
    case SECTOR_TAGS.ADMIN_MATCHES_LOOKUP:
    case SECTOR_TAGS.ADMIN_STREAMS_TODAY:
      return type === REALTIME_EVENTS.MATCHES_UPDATED;
    case SECTOR_TAGS.ADMIN_PREDICTIONS:
      return (
        type === REALTIME_EVENTS.MATCHES_UPDATED || type === REALTIME_EVENTS.LEADERBOARD_UPDATED
      );
    case SECTOR_TAGS.ADMIN_SYNC:
      return type === REALTIME_EVENTS.SYNC_COMPLETE;
    case SECTOR_TAGS.ADMIN_STATS:
      return type === REALTIME_EVENTS.SYNC_COMPLETE || type === REALTIME_EVENTS.LEADERBOARD_UPDATED;
    case SECTOR_TAGS.ADMIN_SIMULATION:
      return (
        type === REALTIME_EVENTS.MATCHES_UPDATED || type === REALTIME_EVENTS.LEADERBOARD_UPDATED
      );
    case SECTOR_TAGS.ADMIN_AI_OVERVIEW:
      return (
        type === REALTIME_EVENTS.MATCHES_UPDATED || type === REALTIME_EVENTS.LEADERBOARD_UPDATED
      );
    default:
      return ALL_REALTIME_EVENTS.includes(type);
  }
}
