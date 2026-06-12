/** Ventana tras el kickoff en la que seguimos refrescando (timeline FIFA + reporte). */
export const RECENT_MATCH_POLL_MS = 8 * 60 * 60 * 1000;

/**
 * ¿Debe el ranking seguir haciendo poll?
 * Además de partidos en vivo / próximos, incluye finalizados recientes (datos FIFA tardan en completarse).
 */
export function shouldPollLeaderboardLive(data, now = Date.now()) {
  if ((data?.liveMatches?.length ?? 0) > 0) return true;
  if ((data?.nextUpcomingMatches?.length ?? 0) > 0) return true;

  const cutoff = now - RECENT_MATCH_POLL_MS;
  return (data?.recentFinishedMatches ?? []).some((match) => {
    const kickoffMs = new Date(match.kickoffAt || 0).getTime();
    return Number.isFinite(kickoffMs) && kickoffMs >= cutoff;
  });
}
