/** Clave corta para invalidar caché de enriquecimiento cuando cambia el marcador o la cronología. */
export function matchEnrichmentRevision(raw = {}) {
  const timeline = raw.fifaEvents?.timeline ?? raw.raw?.fifaEvents?.timeline;
  const timelineLen = Array.isArray(timeline) ? timeline.length : 0;
  const elapsed = raw.time_elapsed ?? raw.timeElapsed ?? raw.raw?.time_elapsed ?? '';
  const homeScore = raw.homeScore ?? raw.raw?.homeScore ?? '';
  const awayScore = raw.awayScore ?? raw.raw?.awayScore ?? '';
  return [
    raw.finished ?? raw.raw?.finished ? '1' : '0',
    homeScore,
    awayScore,
    elapsed,
    timelineLen,
  ].join(':');
}

export function featuredBarInputsSignature(activeLiveRaw = [], recentFeaturedRaw = []) {
  const sig = (matches) =>
    matches.map((m) => `${m._id}:${matchEnrichmentRevision(m)}`).join('|');
  return `${sig(activeLiveRaw)}#${sig(recentFeaturedRaw)}`;
}
