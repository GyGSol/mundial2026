import { POST_FINISH_GRACE_MS, isRecentlyFinishedMatch } from './recentFinishedMatches.js';

/** IDs de partidos mostrados en la barra destacada (evitar duplicados en listados). */
export function matchBarFeaturedIds({ liveMatches = [], recentFinishedMatches = [] } = {}) {
  const hasLive = (liveMatches?.length ?? 0) > 0;
  const barMatches = hasLive ? liveMatches : [...liveMatches, ...recentFinishedMatches];
  return new Set(barMatches.map((match) => match?.id).filter(Boolean));
}

/**
 * Ocultar del listado de predicciones:
 * - en vivo (van en la barra)
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

  if (hasLive) {
    for (const match of allMatches) {
      if (isRecentlyFinishedMatch(match)) ids.add(match.id);
    }
  } else {
    for (const match of recentFinishedMatches) {
      if (match?.id) ids.add(match.id);
    }
  }

  return ids;
}

/** ¿Sigue activo el poll de predicciones por partidos en barra? */
export function shouldPollPredictionsBar(payload) {
  return (
    (payload?.liveMatches?.length ?? 0) > 0 ||
    (payload?.recentFinishedMatches?.length ?? 0) > 0 ||
    (payload?.matches ?? []).some((m) => m.status === 'live')
  );
}

export { POST_FINISH_GRACE_MS };
