import { getEffectiveMatchPlayState, resolvePausedDisplayClock } from './matchPlayState.js';

/** @param {Record<string, unknown> | string | null | undefined} rawOrElapsed */
export function formatTimeElapsed(rawOrElapsed) {
  const value =
    rawOrElapsed && typeof rawOrElapsed === 'object'
      ? rawOrElapsed.time_elapsed ?? rawOrElapsed.timeElapsed
      : rawOrElapsed;

  if (value == null) return null;

  const normalized = String(value).trim().toLowerCase();
  if (!normalized || normalized === 'notstarted' || normalized === '0') return null;
  if (normalized === 'live' || normalized === 'inprogress' || normalized === 'in progress') {
    return null;
  }
  if (normalized === 'finished' || normalized === 'ft' || normalized === 'fulltime') {
    return 'Final';
  }
  if (normalized === 'ht' || normalized === 'halftime') return 'Entretiempo';

  if (/^\d+\+\d+$/.test(normalized)) {
    return `${normalized}'`;
  }

  const minute = Number(normalized);
  if (Number.isFinite(minute) && minute > 0) {
    return `${minute}'`;
  }

  return normalized;
}

export function clockSortKeyFromParts(minute, extraMinute) {
  if (minute == null || !Number.isFinite(Number(minute))) return Number.NEGATIVE_INFINITY;
  if (extraMinute != null && Number(extraMinute) > 0) {
    return Number(minute) + Number(extraMinute) / 100;
  }
  return Number(minute);
}

export function formatClockMinute(minute, extraMinute) {
  if (minute == null || !Number.isFinite(Number(minute))) return null;
  if (extraMinute != null && Number(extraMinute) > 0) {
    return `${minute}+${extraMinute}'`;
  }
  return `${minute}'`;
}

export function parseElapsedClockToSortKey(clock) {
  if (clock == null) return Number.NEGATIVE_INFINITY;

  const normalized = String(clock).trim().replace(/'+$/, '').toLowerCase();
  if (normalized === 'ht' || normalized === 'halftime' || normalized === 'entretiempo') {
    return 45;
  }
  if (normalized === 'finished' || normalized === 'ft' || normalized === 'fulltime' || normalized === 'final') {
    return 90;
  }

  const extraMatch = normalized.match(/^(\d+)\+(\d+)$/);
  if (extraMatch) {
    return Number(extraMatch[1]) + Number(extraMatch[2]) / 100;
  }

  const minute = Number(normalized);
  if (Number.isFinite(minute)) return minute;

  return Number.NEGATIVE_INFINITY;
}

/** @param {Array<{ minute?: number | null, extraMinute?: number | null, sortKey?: number }>} timeline */
export function latestClockFromTimeline(timeline = []) {
  let best = null;
  let bestKey = Number.NEGATIVE_INFINITY;

  for (const event of timeline) {
    if (event.minute == null || !Number.isFinite(Number(event.minute))) continue;

    const key =
      event.sortKey != null && Number.isFinite(Number(event.sortKey))
        ? Number(event.sortKey)
        : clockSortKeyFromParts(event.minute, event.extraMinute);

    if (key > bestKey) {
      bestKey = key;
      best = event;
    }
  }

  return best ? formatClockMinute(best.minute, best.extraMinute) : null;
}

/**
 * Elige el reloj más avanzado entre dos tokens crudos (p. ej. time_elapsed).
 * Evita retroceder de 59' a 45+5' cuando el snapshot está atrasado.
 */
export function pickAdvancedRawElapsed(existing, incoming) {
  const a = existing == null ? null : String(existing).trim();
  const b = incoming == null ? null : String(incoming).trim();
  if (!a) return b ?? null;
  if (!b) return a;

  const aNorm = a.toLowerCase();
  const bNorm = b.toLowerCase();

  if (aNorm === 'ht' || aNorm === 'halftime') {
    if (parseElapsedClockToSortKey(b) > 45.5) return b;
    return a;
  }
  if (bNorm === 'ht' || bNorm === 'halftime') {
    if (parseElapsedClockToSortKey(a) > 45.5) return a;
    return b;
  }

  if (aNorm === 'finished' || aNorm === 'ft') return a;
  if (bNorm === 'finished' || bNorm === 'ft') return b;

  return parseElapsedClockToSortKey(a) >= parseElapsedClockToSortKey(b) ? a : b;
}

/**
 * @param {Record<string, unknown>} raw
 * @param {Array<{ minute?: number | null, extraMinute?: number | null, sortKey?: number }>} timeline
 */
export function resolveLiveTimeElapsed(raw, timeline = []) {
  const fromApi = formatTimeElapsed(raw);
  const fromTimeline = latestClockFromTimeline(timeline);

  if (!fromTimeline) return fromApi;
  if (!fromApi) return fromTimeline;

  if (fromApi === 'Entretiempo') {
    if (parseElapsedClockToSortKey(fromTimeline) > 45.5) return fromTimeline;
    return fromApi;
  }

  if (fromApi === 'Final') {
    const timelineKey = parseElapsedClockToSortKey(fromTimeline);
    if (timelineKey >= 0 && timelineKey < 85) return fromTimeline;
    return fromApi;
  }

  return parseElapsedClockToSortKey(fromTimeline) >= parseElapsedClockToSortKey(fromApi)
    ? fromTimeline
    : fromApi;
}

function normalizeClockLabel(value) {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return `${value}'`;
  }
  const asString = String(value).trim();
  if (!asString) return null;
  if (asString.includes("'")) return asString;
  return formatTimeElapsed({ time_elapsed: asString });
}

/** Último minuto en listas de goleadores enriquecidas (p. ej. raw.home_scorers). */
export function latestMinuteFromScorerLists(...lists) {
  let best = null;

  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const scorer of list) {
      const minute = Number(scorer?.minute);
      if (Number.isFinite(minute)) {
        best = best == null ? minute : Math.max(best, minute);
      }
    }
  }

  return best != null ? `${best}'` : null;
}

/** Elige el reloj más avanzado entre todas las fuentes disponibles. */
export function pickLiveDisplayClock(...sources) {
  let bestKey = Number.NEGATIVE_INFINITY;
  let bestLabel = null;

  for (const source of sources.flat()) {
    const label = normalizeClockLabel(source);
    if (!label || label === 'Entretiempo' || label === 'Final') continue;
    const key = parseElapsedClockToSortKey(label);
    if (key > bestKey) {
      bestKey = key;
      bestLabel = label;
    }
  }

  return bestLabel;
}

export function resolveLiveMatchDisplayClock(match, timeline = match?.matchTimeline ?? []) {
  const playState = getEffectiveMatchPlayState(match);
  if (playState.phase === 'halftime') return 'Entretiempo';
  const pausedClock = resolvePausedDisplayClock(playState);
  if (pausedClock && playState.phase !== 'in_play') {
    return pausedClock;
  }

  const raw = match?.raw ?? {};
  return (
    pickLiveDisplayClock(
      match?.timeElapsed,
      match?.minute,
      raw?.time_elapsed ?? raw?.timeElapsed,
      resolveLiveTimeElapsed(raw, timeline),
      latestClockFromTimeline(timeline),
      latestMinuteFromScorerLists(match?.homeScorers, match?.awayScorers)
    ) ?? resolveLiveTimeElapsed(raw, timeline)
  );
}

export function goalCountsFromTimeline(timeline = []) {
  let home = 0;
  let away = 0;

  for (const event of timeline) {
    if (event?.type !== 'goal') continue;
    if (event.minute == null && !event.player) continue;
    if (event.side === 'home') home += 1;
    else if (event.side === 'away') away += 1;
  }

  return { home, away };
}

function maxTimelineSortKey(timeline = []) {
  let best = Number.NEGATIVE_INFINITY;
  for (const event of timeline) {
    if (event?.minute == null || !Number.isFinite(Number(event.minute))) continue;
    const key =
      event.sortKey != null && Number.isFinite(Number(event.sortKey))
        ? Number(event.sortKey)
        : clockSortKeyFromParts(event.minute, event.extraMinute);
    if (key > best) best = key;
  }
  return best;
}

function liveMatchClockSortKey(match) {
  return parseElapsedClockToSortKey(resolveLiveMatchDisplayClock(match, match?.matchTimeline ?? []));
}

function incomingScoresMatchTimeline(incoming) {
  const tl = goalCountsFromTimeline(incoming.matchTimeline);
  const home = Number(incoming.homeScore) || 0;
  const away = Number(incoming.awayScore) || 0;
  return home === tl.home && away === tl.away;
}

/** Parche/snapshot atrasado: no debe pisar marcador ni reloj del cliente. */
export function isIncomingLivePatchStale(existing, incoming) {
  if (!existing || !incoming) return false;

  const existingClock = Math.max(
    liveMatchClockSortKey(existing),
    maxTimelineSortKey(existing.matchTimeline)
  );
  const incomingClock = Math.max(
    liveMatchClockSortKey(incoming),
    maxTimelineSortKey(incoming.matchTimeline)
  );

  const existingGoals = goalCountsFromTimeline(existing.matchTimeline);
  const incomingGoals = goalCountsFromTimeline(incoming.matchTimeline);
  const existingTotal =
    (Number(existing.homeScore) || 0) + (Number(existing.awayScore) || 0);
  const incomingTotal =
    (Number(incoming.homeScore) || 0) + (Number(incoming.awayScore) || 0);
  const existingGoalEvents = existingGoals.home + existingGoals.away;
  const incomingGoalEvents = incomingGoals.home + incomingGoals.away;

  if (incomingTotal > existingTotal) return false;
  if (incomingGoalEvents > existingGoalEvents) return false;
  if (incomingClock < existingClock - 0.001) return true;

  const serverCorrection =
    incomingClock + 0.001 >= existingClock &&
    (incomingTotal < existingTotal || incomingGoalEvents < existingGoalEvents) &&
    incomingScoresMatchTimeline(incoming);
  if (serverCorrection) return false;

  if (incomingClock <= existingClock && incomingTotal < existingTotal) return true;
  if (incomingClock <= existingClock && incomingGoalEvents < existingGoalEvents) return true;

  return false;
}

function mergePlausibleGoalCount(official, timelineCount, fallback = 0) {
  const o = Number(official);
  const t = Number(timelineCount);
  const f = Number(fallback);
  const base = Number.isFinite(o) ? o : Number.isFinite(f) ? f : 0;
  return Number.isFinite(t) ? Math.max(base, t) : base;
}

/** Marcador en vivo: confía en el servidor si el parche es fresco; si no, no retrocede. */
export function reconcileLiveScores(existing, incoming, mergedTimeline, { incomingStale } = {}) {
  if (!incomingStale && incoming) {
    const home = Number(incoming.homeScore);
    const away = Number(incoming.awayScore);
    if (Number.isFinite(home) && Number.isFinite(away)) {
      return { homeScore: home, awayScore: away };
    }
  }

  const tl = goalCountsFromTimeline(mergedTimeline);
  const scoreSource = incomingStale ? existing : incoming;

  return {
    homeScore: mergePlausibleGoalCount(
      scoreSource?.homeScore,
      tl.home,
      Math.max(Number(existing?.homeScore) || 0, Number(incoming?.homeScore) || 0)
    ),
    awayScore: mergePlausibleGoalCount(
      scoreSource?.awayScore,
      tl.away,
      Math.max(Number(existing?.awayScore) || 0, Number(incoming?.awayScore) || 0)
    ),
  };
}
