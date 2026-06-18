/** ¿Debe el ranking seguir haciendo poll? Con en vivo, recién finalizados, baseline activo o próximos partidos. */
export function shouldPollLeaderboardLive(data) {
  if ((data?.liveMatches?.length ?? 0) > 0) return true;
  if ((data?.recentFinishedMatches?.length ?? 0) > 0) return true;
  if ((data?.leaderboardKickoffBaseline?.length ?? 0) > 0) return true;
  return (data?.nextUpcomingMatches?.length ?? 0) > 0;
}

export const LEADERBOARD_LIVE_POLL_MS = 5_000;
export const LEADERBOARD_ACTIVE_POLL_MS = 10_000;
export const LEADERBOARD_IDLE_POLL_MS = 15_000;

/** Intervalo de poll según actividad en el dashboard. */
export function leaderboardPollIntervalMs(data) {
  if ((data?.liveMatches?.length ?? 0) > 0) return LEADERBOARD_LIVE_POLL_MS;
  if (shouldPollLeaderboardLive(data)) return LEADERBOARD_ACTIVE_POLL_MS;
  return LEADERBOARD_IDLE_POLL_MS;
}
