import { POST_FINISH_GRACE_MS } from './recentFinishedMatches.js';

/** IDs de partidos mostrados en la barra destacada (evitar duplicados en listados). */
export function matchBarFeaturedIds({ liveMatches = [], recentFinishedMatches = [] } = {}) {
  const hasLive = (liveMatches?.length ?? 0) > 0;
  const barMatches = hasLive ? liveMatches : [...liveMatches, ...recentFinishedMatches];
  return new Set(barMatches.map((match) => match?.id).filter(Boolean));
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
