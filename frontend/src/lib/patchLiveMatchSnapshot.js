import { timelineEventIdentity, isPlaceholderTimelineGoal } from './matchTimelineDisplay.js';
import {
  isIncomingLivePatchStale,
  pickAdvancedRawElapsed,
  reconcileLiveScores,
  resolveLiveTimeElapsed,
  resolveLiveMatchDisplayClock,
} from './liveMatchClock.js';

const LIVE_SCALAR_FIELDS = [
  'status',
  'minute',
  'weatherOps',
  'weatherOpsLabel',
  'matchPlayState',
  'predictionOpen',
  'finishedAt',
  'liveStartedPushSentAt',
];

const LIVE_DERIVED_LIST_FIELDS = [
  'homeScorers',
  'awayScorers',
  'homeBookings',
  'awayBookings',
  'homeSubstitutions',
  'awaySubstitutions',
];

function timelineEventSortKey(event) {
  if (event?.sortKey != null) {
    const key = Number(event.sortKey);
    if (Number.isFinite(key)) return key;
  }
  if (event?.minute == null || !Number.isFinite(Number(event.minute))) {
    return Number.NEGATIVE_INFINITY;
  }
  return Number(event.minute) + Number(event.extraMinute ?? 0) / 100;
}

function sortTimelineEvents(events) {
  return events.slice().sort((a, b) => {
    const keyDiff = timelineEventSortKey(a) - timelineEventSortKey(b);
    if (keyDiff !== 0) return keyDiff;
    return timelineEventIdentity(a).localeCompare(timelineEventIdentity(b));
  });
}

/**
 * Une cronologías por identidad estable. Nunca elimina eventos ya mostrados
 * (evita parpadeos cuando el snapshot llega con menos eventos que el dashboard).
 */
export function mergeTimelineEvents(existing = [], incoming = [], options = {}) {
  const prev = Array.isArray(existing) ? existing : [];
  const next = Array.isArray(incoming) ? incoming : [];

  if (!next.length) return prev;
  if (!prev.length) return sortTimelineEvents(next);

  const incomingStale = options.incomingStale === true;
  if (!incomingStale) {
    const prevMax = maxTimelineSortKey(prev);
    const nextMax = maxTimelineSortKey(next);
    const prevGoals = goalCountsFromTimeline(prev);
    const nextGoals = goalCountsFromTimeline(next);
    const prevGoalTotal = prevGoals.home + prevGoals.away;
    const nextGoalTotal = nextGoals.home + nextGoals.away;

    if (nextMax > prevMax + 0.001 || nextGoalTotal > prevGoalTotal) {
      return sortTimelineEvents(next);
    }
    // Snapshot fresco con menos goles al mismo minuto: descartar fantasmas acumulados en cliente.
    if (next.length > 0 && nextGoalTotal < prevGoalTotal && nextMax + 0.001 >= prevMax) {
      return sortTimelineEvents(next);
    }
  }

  const merged = new Map();
  for (const event of prev) {
    merged.set(timelineEventIdentity(event), event);
  }
  for (const event of next) {
    const id = timelineEventIdentity(event);
    const prior = merged.get(id);
    merged.set(id, prior ? { ...prior, ...event } : event);
  }

  return sortTimelineEvents([...merged.values()]);
}

function maxTimelineSortKey(timeline = []) {
  let best = Number.NEGATIVE_INFINITY;
  for (const event of timeline) {
    if (event?.minute == null || !Number.isFinite(Number(event.minute))) continue;
    const key =
      event.sortKey != null && Number.isFinite(Number(event.sortKey))
        ? Number(event.sortKey)
        : timelineEventSortKey(event);
    if (key > best) best = key;
  }
  return best;
}

function goalCountsFromTimeline(timeline = []) {
  let home = 0;
  let away = 0;
  for (const event of timeline) {
    if (event?.type !== 'goal') continue;
    if (isPlaceholderTimelineGoal(event)) continue;
    if (event.side === 'home') home += 1;
    else if (event.side === 'away') away += 1;
  }
  return { home, away };
}

function mergeDerivedList(existing, incoming, { incomingStale } = {}) {
  const prev = Array.isArray(existing) ? existing : [];
  const next = Array.isArray(incoming) ? incoming : [];
  if (!next.length) return prev;
  if (incomingStale) return prev;
  if (next.length >= prev.length) return next;
  return prev;
}

function mergeLineup(existing, incoming, { incomingStale } = {}) {
  if (!incoming) return existing;
  if (incomingStale) return existing ?? incoming;
  return incoming;
}

/** Fusiona un partido en vivo sin reemplazar la cronología completa a ciegas. */
export function mergeLiveMatchFields(existing, incoming) {
  if (!incoming) return existing;
  if (!existing) return incoming;

  const incomingStale = isIncomingLivePatchStale(existing, incoming);
  const merged = { ...existing, ...incoming };

  if (!incomingStale) {
    for (const field of LIVE_SCALAR_FIELDS) {
      if (incoming[field] !== undefined) {
        merged[field] = incoming[field];
      }
    }
  } else {
    for (const field of LIVE_SCALAR_FIELDS) {
      if (field === 'homeScore' || field === 'awayScore') continue;
      if (incoming[field] !== undefined && existing[field] === undefined) {
        merged[field] = incoming[field];
      }
    }
  }

  if (incoming.raw && typeof incoming.raw === 'object') {
    const existingRaw = existing.raw ?? {};
    merged.raw = incomingStale ? { ...existingRaw } : { ...existingRaw, ...incoming.raw };
    merged.raw.time_elapsed = pickAdvancedRawElapsed(
      existingRaw.time_elapsed ?? existingRaw.timeElapsed,
      incoming.raw.time_elapsed ?? incoming.raw.timeElapsed
    );
  }

  merged.matchTimeline = mergeTimelineEvents(existing.matchTimeline, incoming.matchTimeline, {
    incomingStale,
  });

  for (const field of LIVE_DERIVED_LIST_FIELDS) {
    merged[field] = mergeDerivedList(existing[field], incoming[field], { incomingStale });
  }

  if (incoming.lineup !== undefined) {
    merged.lineup = mergeLineup(existing.lineup, incoming.lineup, { incomingStale });
  }

  const scores = reconcileLiveScores(existing, incoming, merged.matchTimeline, { incomingStale });
  merged.homeScore = scores.homeScore;
  merged.awayScore = scores.awayScore;
  merged.timeElapsed =
    resolveLiveMatchDisplayClock(
      {
        ...merged,
        kickoffAt: merged.kickoffAt ?? existing?.kickoffAt ?? incoming?.kickoffAt,
      },
      merged.matchTimeline ?? []
    ) ?? resolveLiveTimeElapsed(merged.raw ?? {}, merged.matchTimeline ?? []);

  return merged;
}

function patchMatchInList(list, incomingById) {
  if (!Array.isArray(list)) return list;
  return list.map((match) => {
    const incoming = incomingById.get(match.id);
    return incoming ? mergeLiveMatchFields(match, incoming) : match;
  });
}

/** Une listas de partidos preservando cronología acumulada en el cliente. */
export function mergeLiveMatchLists(prevList = [], nextList = []) {
  const prev = Array.isArray(prevList) ? prevList : [];
  const next = Array.isArray(nextList) ? nextList : [];
  if (!next.length) return prev;
  if (!prev.length) return next;

  const nextById = new Map(next.filter((m) => m?.id).map((m) => [m.id, m]));
  const prevById = new Map(prev.filter((m) => m?.id).map((m) => [m.id, m]));
  const orderedIds = [
    ...next.map((m) => m.id),
    ...prev.map((m) => m.id).filter((id) => id && !nextById.has(id)),
  ];

  const seen = new Set();
  const merged = [];
  for (const id of orderedIds) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const prior = prevById.get(id);
    const incoming = nextById.get(id);
    if (prior && incoming) merged.push(mergeLiveMatchFields(prior, incoming));
    else merged.push(incoming ?? prior);
  }
  return merged;
}

/**
 * Fusiona un refresh completo (poll/dashboard) con el estado previo del cliente.
 * Evita que un dashboard cacheado en backend borre eventos ya mostrados.
 */
export function mergeLiveDashboard(prev, next) {
  if (!next) return prev ?? null;
  if (!prev) return next;

  const merged = { ...next };

  if (Array.isArray(next.liveMatches) || Array.isArray(prev.liveMatches)) {
    merged.liveMatches = mergeLiveMatchLists(prev.liveMatches, next.liveMatches);
  }
  if (Array.isArray(next.recentFinishedMatches) || Array.isArray(prev.recentFinishedMatches)) {
    merged.recentFinishedMatches = mergeLiveMatchLists(
      prev.recentFinishedMatches,
      next.recentFinishedMatches
    );
  }
  if (Array.isArray(next.matches) || Array.isArray(prev.matches)) {
    merged.matches = mergeLiveMatchLists(prev.matches, next.matches);
  }

  return merged;
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
