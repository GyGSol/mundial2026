const DEFAULT_MAX = 12;
const RECENT_MS = 7 * 24 * 60 * 60 * 1000;

/** Partidos finalizados recientes para la barra del ranking (más nuevos primero). */
export function pickRecentFinishedMatches(matches = [], { now = Date.now(), max = DEFAULT_MAX } = {}) {
  const cutoff = now - RECENT_MS;

  return [...matches]
    .filter((match) => {
      const kickoffMs = new Date(match.kickoffAt || 0).getTime();
      return Number.isFinite(kickoffMs) && kickoffMs >= cutoff;
    })
    .sort((a, b) => new Date(b.kickoffAt || 0) - new Date(a.kickoffAt || 0))
    .slice(0, max);
}
