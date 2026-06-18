import { POST_FINISH_GRACE_MS, isRecentlyFinishedMatch } from './recentFinishedMatches.js';

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

/** ¿Sigue activo el poll de predicciones por partidos en vivo o recién finalizados? */
export function shouldPollPredictionsBar(payload) {
  return (
    (payload?.liveMatches?.length ?? 0) > 0 ||
    (payload?.recentFinishedMatches?.length ?? 0) > 0 ||
    (payload?.matches ?? []).some((m) => m.status === 'live')
  );
}

export { POST_FINISH_GRACE_MS };
