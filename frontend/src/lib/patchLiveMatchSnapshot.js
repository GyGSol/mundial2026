function patchMatchInList(list, incomingById) {
  if (!Array.isArray(list)) return list;
  return list.map((match) => {
    const incoming = incomingById.get(match.id);
    return incoming ? { ...match, ...incoming } : match;
  });
}

function appendNewMatches(list, incoming, existingIds) {
  const base = Array.isArray(list) ? list : [];
  const additions = incoming.filter((match) => match?.id && !existingIds.has(match.id));
  return additions.length ? [...base, ...additions] : base;
}

function collectIds(...lists) {
  const ids = new Set();
  for (const list of lists) {
    for (const match of list ?? []) {
      if (match?.id) ids.add(match.id);
    }
  }
  return ids;
}

/**
 * Fusiona un live-snapshot en payloads con liveMatches / recentFinishedMatches
 * (ranking dashboard, predictions/matches, etc.).
 */
export function mergeLiveSnapshot(data, snapshot) {
  if (!data || !snapshot) return data;

  const liveIncoming = snapshot.liveMatches ?? [];
  const recentIncoming = snapshot.recentFinishedMatches ?? [];
  const liveById = new Map(liveIncoming.map((m) => [m.id, m]));
  const recentById = new Map(recentIncoming.map((m) => [m.id, m]));

  const nextLive = patchMatchInList(data.liveMatches, liveById);
  const nextRecent = patchMatchInList(data.recentFinishedMatches, recentById);

  const existingLiveIds = collectIds(nextLive);
  const existingRecentIds = collectIds(nextRecent);

  const liveWithNew = appendNewMatches(nextLive, liveIncoming, existingLiveIds);
  const recentWithNew = appendNewMatches(nextRecent, recentIncoming, existingRecentIds);

  let nextMatches = data.matches;
  if (Array.isArray(data.matches)) {
    const allIncoming = new Map([...liveById, ...recentById]);
    nextMatches = patchMatchInList(data.matches, allIncoming);
  }

  return {
    ...data,
    matches: nextMatches ?? data.matches,
    liveMatches: liveWithNew,
    recentFinishedMatches: recentWithNew,
  };
}
