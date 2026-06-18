import { POST_FINISH_GRACE_MS, isRecentlyFinishedMatch } from './recentFinishedMatches.js';
import {
  leaderboardPollIntervalMs,
  shouldPollLeaderboardLive,
} from './leaderboardPolling.js';

/** IDs de partidos destacados en predicciones (evitar duplicados en el listado). */
export function matchBarFeaturedIds({ liveMatches = [], recentFinishedMatches = [] } = {}) {
  const hasLive = (liveMatches?.length ?? 0) > 0;
  const barMatches = hasLive ? liveMatches : [...liveMatches, ...recentFinishedMatches];
  return new Set(barMatches.map((match) => match?.id).filter(Boolean));
}

/**
 * Ocultar del listado de predicciones los partidos ya mostrados arriba (destacados):
 * - en vivo
 * - recién finalizados en gracia de 30 min (si hay live, no se muestran en ningún lado)
 */
export function predictionsListExcludeIds({
  liveMatches = [],
  recentFinishedMatches = [],
  allMatches = [],
} = {}) {
  const hasLive = (liveMatches?.length ?? 0) > 0;
  const ids = new Set();

  for (const match of liveMatches) {
    if (match?.id) ids.add(match.id);
  }

  for (const match of recentFinishedMatches) {
    if (match?.id) ids.add(match.id);
  }

  // Respaldo si el listado principal no trae finishedAt pero el partido sigue en gracia.
  if (hasLive) {
    for (const match of allMatches) {
      if (isRecentlyFinishedMatch(match)) ids.add(match.id);
    }
  }

  return ids;
}

function predictionsPollPayload(payload) {
  const adapted = {
    liveMatches: payload?.liveMatches,
    recentFinishedMatches: payload?.recentFinishedMatches,
    nextUpcomingMatches: (payload?.matches ?? []).filter((m) => m.status === 'upcoming'),
  };
  const hasListLive = (payload?.matches ?? []).some((m) => m.status === 'live');
  if (hasListLive && !(payload?.liveMatches?.length ?? 0)) {
    adapted.liveMatches = [{ id: 'list-live' }];
  }
  return adapted;
}

/** ¿Sigue activo el poll de predicciones por partidos en vivo o recién finalizados? */
export function shouldPollPredictionsBar(payload) {
  return shouldPollLeaderboardLive(predictionsPollPayload(payload));
}

/** Misma cadencia que ranking cuando hay live o recién finalizados. */
export function predictionsPollIntervalMs(payload) {
  return leaderboardPollIntervalMs(predictionsPollPayload(payload));
}

export { POST_FINISH_GRACE_MS };
