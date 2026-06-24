/** @typedef {{ name: string, minute: number | null, extraMinute?: number | null, isPenalty?: boolean }} MatchScorer */
/** @typedef {{ minute: number | null, player: string, card: string }} MatchBooking */
/** @typedef {{ minute: number | null, playerOut: string, playerIn: string }} MatchSubstitution */

import {
  buildFifaTimelineEntry,
  dedupeTimelineBySlot,
  mergeShotAttemptsFromRawEvents,
} from './fifaTimelineParser.js';
import { enrichNameFromRoster, normalizeName } from '../utils/playerNameMatch.js';
import { mapPlayerToTimelineRosterEntry } from './playerPhotoService.js';
import {
  applyShirtNumbersToTimeline,
  attachTimelinePlayerIds,
} from '../utils/fifaSquadShirtMap.js';
import {
  resolveMatchPlayState,
  serializeMatchPlayStateForClient,
  resolvePausedDisplayClock,
} from './matchPlayStateService.js';

/** Máximo goles plausibles en un partido (incluye prórroga). */
export const MAX_PLAUSIBLE_MATCH_GOALS = 15;

export function isPlausibleMatchGoalCount(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= MAX_PLAUSIBLE_MATCH_GOALS && Math.floor(n) === n;
}

export function sanitizeMatchGoalCount(value, fallback = 0) {
  return isPlausibleMatchGoalCount(value) ? Number(value) : fallback;
}

export function sanitizeMatchScores(
  home,
  away,
  fallback = { homeScore: 0, awayScore: 0 }
) {
  return {
    homeScore: sanitizeMatchGoalCount(home, fallback.homeScore ?? 0),
    awayScore: sanitizeMatchGoalCount(away, fallback.awayScore ?? 0),
  };
}

/** Ignora marcadores corruptos (p. ej. año persa 1405 de worldcup26) y toma el máximo válido. */
export function mergePlausibleGoalCounts(...values) {
  const plausible = values
    .map((value) => (isPlausibleMatchGoalCount(value) ? Number(value) : null))
    .filter((value) => value != null);

  return plausible.length ? Math.max(...plausible) : 0;
}

export function splitFootballDataEvents(matchData, homeFdTeamId, awayFdTeamId) {
  const homeId = Number(homeFdTeamId);
  const awayId = Number(awayFdTeamId);

  const sideOf = (teamId) => {
    if (teamId === homeId) return 'home';
    if (teamId === awayId) return 'away';
    return null;
  };

  const homeBookings = [];
  const awayBookings = [];
  const homeSubstitutions = [];
  const awaySubstitutions = [];

  for (const booking of matchData?.bookings ?? []) {
    const side = sideOf(booking?.team?.id);
    if (!side || !booking?.player?.name) continue;

    const entry = {
      minute: Number.isFinite(Number(booking.minute)) ? Number(booking.minute) : null,
      player: String(booking.player.name).trim(),
      card: String(booking.card ?? 'YELLOW').toUpperCase(),
    };

    if (side === 'home') homeBookings.push(entry);
    else awayBookings.push(entry);
  }

  for (const substitution of matchData?.substitutions ?? []) {
    const side = sideOf(substitution?.team?.id);
    const playerOut = substitution?.playerOut?.name ?? substitution?.player?.name;
    const playerIn = substitution?.playerIn?.name ?? substitution?.assist?.name;
    if (!side || !playerOut || !playerIn) continue;

    const entry = {
      minute: Number.isFinite(Number(substitution.minute)) ? Number(substitution.minute) : null,
      playerOut: String(playerOut).trim(),
      playerIn: String(playerIn).trim(),
    };

    if (side === 'home') homeSubstitutions.push(entry);
    else awaySubstitutions.push(entry);
  }

  const byMinute = (a, b) => (a.minute ?? 0) - (b.minute ?? 0);

  return {
    homeBookings: homeBookings.sort(byMinute),
    awayBookings: awayBookings.sort(byMinute),
    homeSubstitutions: homeSubstitutions.sort(byMinute),
    awaySubstitutions: awaySubstitutions.sort(byMinute),
  };
}

export function readStoredMatchEvents(raw = {}) {
  const fdEvents = raw.fdEvents ?? {};
  const wcEvents = readWorldCupApiEvents(raw);

  return mergeMatchEvents(fdEvents, wcEvents);
}

export function countStoredEvents(events = {}) {
  return (
    (events.homeBookings?.length ?? 0) +
    (events.awayBookings?.length ?? 0) +
    (events.homeSubstitutions?.length ?? 0) +
    (events.awaySubstitutions?.length ?? 0)
  );
}

export function mergeMatchEvents(primary = {}, secondary = {}) {
  return {
    homeBookings:
      primary.homeBookings?.length > 0 ? primary.homeBookings : (secondary.homeBookings ?? []),
    awayBookings:
      primary.awayBookings?.length > 0 ? primary.awayBookings : (secondary.awayBookings ?? []),
    homeSubstitutions:
      primary.homeSubstitutions?.length > 0
        ? primary.homeSubstitutions
        : (secondary.homeSubstitutions ?? []),
    awaySubstitutions:
      primary.awaySubstitutions?.length > 0
        ? primary.awaySubstitutions
        : (secondary.awaySubstitutions ?? []),
  };
}

function detectCardType(text) {
  const normalized = String(text ?? '').toUpperCase();
  if (/\b(YELLOW_RED|YELLOW\/RED|SECOND\s+YELLOW|2\s*Y|🟨🟥)\b/.test(normalized)) {
    return 'YELLOW_RED';
  }
  if (/\b(RED|🟥|R)\b/.test(normalized)) return 'RED';
  return 'YELLOW';
}

function stripCardSuffix(text) {
  return String(text ?? '')
    .replace(/\s+(YELLOW_RED|YELLOW\/RED|SECOND\s+YELLOW|YELLOW|RED|Y|R|🟨🟥|🟥|🟨)\s*$/i, '')
    .trim();
}

/**
 * Parsea home_bookings / away_bookings de worldcup26 (mismo estilo que goleadores).
 * @param {unknown} value
 * @returns {MatchBooking[]}
 */
export function parseBookingsField(value) {
  const scorers = parseScorersField(value);
  if (scorers.length === 0) return [];

  if (typeof value === 'string' || Array.isArray(value)) {
    const rawParts = Array.isArray(value)
      ? value.flatMap((entry) => parseScorersField(entry).map((s) => s.name))
      : extractQuotedScorerParts(normalizeSmartQuotes(String(value)).trim());

    if (rawParts.length === scorers.length) {
      return scorers.map((entry, index) => ({
        minute: entry.minute,
        player: stripCardSuffix(entry.name),
        card: detectCardType(rawParts[index] ?? entry.name),
      }));
    }
  }

  return scorers.map((entry) => ({
    minute: entry.minute,
    player: stripCardSuffix(entry.name),
    card: detectCardType(entry.name),
  }));
}

function parseSubstitutionEntry(entry) {
  if (typeof entry === 'string') {
    const trimmed = entry.trim();
    if (!trimmed || isNullishScorerValue(trimmed)) return null;

    const arrowMatch = trimmed.match(/^(\d+)\s*['']?\s+(.+?)\s*(?:→|->|➡)\s*(.+)$/);
    if (arrowMatch) {
      return {
        minute: Number(arrowMatch[1]),
        playerOut: arrowMatch[2].trim(),
        playerIn: arrowMatch[3].trim(),
      };
    }
  }

  if (entry && typeof entry === 'object') {
    const record = /** @type {Record<string, unknown>} */ (entry);
    const playerOut = record.playerOut ?? record.player_out ?? record.out;
    const playerIn = record.playerIn ?? record.player_in ?? record.in;
    if (!playerOut || !playerIn) return null;

    const minuteRaw = record.minute ?? record.time ?? record.min;
    const minute =
      minuteRaw == null || minuteRaw === ''
        ? null
        : Number.isFinite(Number(minuteRaw))
          ? Number(minuteRaw)
          : null;

    return {
      minute,
      playerOut: String(playerOut).trim(),
      playerIn: String(playerIn).trim(),
    };
  }

  return null;
}

export function parseSubstitutionsField(value) {
  if (isNullishScorerValue(value)) return [];
  if (Array.isArray(value)) {
    return value.map(parseSubstitutionEntry).filter(Boolean);
  }

  const trimmed = normalizeSmartQuotes(String(value)).trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map(parseSubstitutionEntry).filter(Boolean);
      }
    } catch {
      // fall through
    }
  }

  const quoted = extractQuotedScorerParts(trimmed);
  const parts = quoted.length > 0 ? quoted : trimmed.split(/[,;|]/).map((part) => part.trim());

  return parts.map(parseSubstitutionEntry).filter(Boolean);
}

function readWorldCupApiEvents(raw = {}) {
  return {
    homeBookings: parseBookingsField(raw.home_bookings ?? raw.homeBookings),
    awayBookings: parseBookingsField(raw.away_bookings ?? raw.awayBookings),
    homeSubstitutions: parseSubstitutionsField(
      raw.home_substitutions ?? raw.homeSubstitutions ?? raw.home_subs ?? raw.homeSubs
    ),
    awaySubstitutions: parseSubstitutionsField(
      raw.away_substitutions ?? raw.awaySubstitutions ?? raw.away_subs ?? raw.awaySubs
    ),
  };
}

export function isNullishScorerValue(value) {
  if (value == null) return true;
  const normalized = String(value).trim().toLowerCase();
  return normalized === '' || normalized === 'null' || normalized === 'undefined';
}

/** worldcup26.ir a veces envía comillas tipográficas (“ ”) en lugar de ASCII. */
export function normalizeSmartQuotes(value) {
  return String(value)
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'");
}

/**
 * @param {string} trimmed
 * @returns {{ name: string, minute: number | null, isPenalty?: boolean }}
 */
function parseScorerText(trimmed) {
  const withPenalty = trimmed.match(/^(.+?)\s+(\d+)\s*['']?\s*\(p(?:en(?:alty)?)?\)\s*$/i);
  if (withPenalty) {
    return {
      name: withPenalty[1].trim(),
      minute: Number(withPenalty[2]),
      isPenalty: true,
    };
  }

  const withTrailingNote = trimmed.match(/^(.+?)\s+(\d+)\s*['']?\s*\([^)]+\)\s*$/);
  if (withTrailingNote) {
    const note = withTrailingNote[0].match(/\(([^)]+)\)/)?.[1]?.toLowerCase() ?? '';
    return {
      name: withTrailingNote[1].trim(),
      minute: Number(withTrailingNote[2]),
      isPenalty: note === 'p' || note === 'pen' || note === 'penalty',
    };
  }

  const extraTimeSuffix = trimmed.match(/^(.+?)\s+(\d+)\+(\d+)\s*['']?\s*$/);
  if (extraTimeSuffix) {
    return {
      name: extraTimeSuffix[1].trim(),
      minute: Number(extraTimeSuffix[2]),
      extraMinute: Number(extraTimeSuffix[3]),
    };
  }

  const minuteSuffix = trimmed.match(/^(.+?)\s+(\d+)\s*['']?\s*$/);
  if (minuteSuffix) {
    return {
      name: minuteSuffix[1].trim(),
      minute: Number(minuteSuffix[2]),
    };
  }

  const minutePrefix = trimmed.match(/^(\d+)\s*['']?\s+(.+)$/);
  if (minutePrefix) {
    return {
      name: minutePrefix[2].trim(),
      minute: Number(minutePrefix[1]),
    };
  }

  return { name: trimmed, minute: null };
}

function normalizeGoalEvent(event) {
  if (event?.type !== 'goal' || event.minute != null || !event.player) return event;

  const parsed = parseScorerText(String(event.player).trim());
  if (parsed.minute == null) return event;

  return {
    ...event,
    player: parsed.name,
    minute: parsed.minute,
    extraMinute: parsed.extraMinute ?? event.extraMinute ?? null,
    sortKey: clockSortKeyFromParts(parsed.minute, parsed.extraMinute),
    ...(parsed.isPenalty ? { isPenalty: true } : {}),
  };
}

/**
 * @param {unknown} entry
 * @returns {MatchScorer | null}
 */
function normalizeScorerEntry(entry) {
  if (typeof entry === 'string') {
    const trimmed = entry.trim();
    if (!trimmed || isNullishScorerValue(trimmed)) return null;
    return parseScorerText(trimmed);
  }

  if (entry && typeof entry === 'object') {
    const record = /** @type {Record<string, unknown>} */ (entry);
    const name = record.name ?? record.player ?? record.scorer ?? record.player_name;
    if (!name) return null;

    const minuteRaw = record.minute ?? record.time ?? record.min ?? record.elapsed;
    let minute =
      minuteRaw == null || minuteRaw === ''
        ? null
        : Number.isFinite(Number(minuteRaw))
          ? Number(minuteRaw)
          : null;

    let parsedName = String(name).trim();
    let isPenalty = Boolean(record.isPenalty);
    let extraMinute =
      record.extraMinute != null && Number.isFinite(Number(record.extraMinute))
        ? Number(record.extraMinute)
        : null;

    if (minute == null) {
      const parsed = parseScorerText(parsedName);
      if (parsed.minute != null) {
        parsedName = parsed.name;
        minute = parsed.minute;
        extraMinute = parsed.extraMinute ?? extraMinute;
        isPenalty = isPenalty || Boolean(parsed.isPenalty);
      }
    }

    return {
      name: parsedName,
      minute,
      ...(extraMinute != null ? { extraMinute } : {}),
      ...(isPenalty ? { isPenalty: true } : {}),
    };
  }

  return null;
}

/**
 * Parsea home_scorers / away_scorers de worldcup26.ir (string "null", JSON o texto).
 * @param {unknown} value
 * @returns {MatchScorer[]}
 */
function extractQuotedScorerParts(trimmed) {
  return [...trimmed.matchAll(/"([^"]+)"/g)].map((match) => match[1].trim()).filter(Boolean);
}

export function parseScorersField(value) {
  if (isNullishScorerValue(value)) return [];

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const entry = normalizeScorerEntry(value);
    return entry ? [entry] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => parseScorersField(entry));
  }

  const trimmed = normalizeSmartQuotes(String(value)).trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    const quoted = extractQuotedScorerParts(trimmed);
    if (quoted.length > 0) {
      return quoted.map(normalizeScorerEntry).filter(Boolean);
    }
  }

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map(normalizeScorerEntry).filter(Boolean);
      }
    } catch {
      // fall through to delimiter parsing
    }
  }

  return trimmed
    .split(/[,;|]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map(normalizeScorerEntry)
    .filter(Boolean);
}

/**
 * @param {Record<string, unknown> | string | null | undefined} rawOrElapsed
 * @returns {string | null}
 */
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

  const normalized = String(clock).trim().replace(/'+$/, '');
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

/** Último minuto declarado en goleadores (worldcup26 suele ir adelantado vs fifaEvents.timeline). */
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

function pickMaxClockLabel(...labels) {
  let bestKey = Number.NEGATIVE_INFINITY;
  let bestLabel = null;
  for (const label of labels) {
    if (!label) continue;
    const key = parseElapsedClockToSortKey(label);
    if (key > bestKey) {
      bestKey = key;
      bestLabel = label;
    }
  }
  return bestLabel;
}

/**
 * @param {Record<string, unknown>} match
 * @param {Array<{ minute?: number | null, extraMinute?: number | null, sortKey?: number }>} timeline
 * @param {Record<string, unknown>} [raw]
 */
export function resolveLiveMatchDisplayClock(match, timeline = [], raw = {}) {
  const effectiveRaw = raw && Object.keys(raw).length ? raw : match?.raw ?? {};
  const playState = match?.matchPlayState ?? resolveMatchPlayState(match, { timeline, raw: effectiveRaw });
  const pausedClock = resolvePausedDisplayClock(playState);
  if (playState.phase === 'halftime') return 'Entretiempo';
  if (pausedClock && playState.phase !== 'in_play') {
    return pausedClock;
  }

  const fromResolved = resolveLiveTimeElapsed(effectiveRaw, timeline);
  const fromScorers = latestMinuteFromScorerLists(
    parseScorersField(effectiveRaw.home_scorers ?? effectiveRaw.homeScorers),
    parseScorersField(effectiveRaw.away_scorers ?? effectiveRaw.awayScorers)
  );

  return pickMaxClockLabel(fromResolved, fromScorers) ?? fromResolved;
}


function toSortKey(minute) {
  if (minute == null || !Number.isFinite(Number(minute))) return Number.POSITIVE_INFINITY;
  return Number(minute);
}

function normalizeGoalPlayer(name) {
  return normalizeName(name);
}

function goalPlayerNamesMatch(a, b) {
  const na = normalizeGoalPlayer(a);
  const nb = normalizeGoalPlayer(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;

  const tokensA = na.split(/\s+/).filter(Boolean);
  const tokensB = nb.split(/\s+/).filter(Boolean);
  if (!tokensA.length || !tokensB.length) return false;

  const lastA = tokensA[tokensA.length - 1];
  const lastB = tokensB[tokensB.length - 1];
  if (lastA.length >= 4 && lastB.length >= 4) {
    if (lastA === lastB || lastA.startsWith(lastB) || lastB.startsWith(lastA)) {
      const firstA = tokensA[0];
      const firstB = tokensB[0];
      if (!firstA || !firstB || firstA[0] === firstB[0]) return true;
    }
  }

  return false;
}

function goalEventRichness(event) {
  let score = 0;
  if (event.playerShirtNumber != null) score += 8;
  if (event.playerPosition) score += 4;
  if (event.player) score += Math.min(String(event.player).length, 20);
  return score;
}

/** Elimina goles duplicados (mismo lado+minuto) al fusionar FIFA y worldcup26. */
export function deduplicateTimelineGoals(timeline = []) {
  const goalIndexByKey = new Map();
  const result = [];

  for (const event of timeline) {
    if (event.type !== 'goal') {
      result.push(event);
      continue;
    }

    const key = [
      event.side ?? '',
      event.minute ?? 'x',
      event.extraMinute ?? 0,
    ].join(':');

    const existingIdx = goalIndexByKey.get(key);
    if (existingIdx == null) {
      goalIndexByKey.set(key, result.length);
      result.push(normalizeGoalEvent({ ...event }));
      continue;
    }

    const existing = result[existingIdx];
    const samePlayer =
      !event.player ||
      !existing.player ||
      goalPlayerNamesMatch(existing.player, event.player);

    if (!samePlayer && event.minute != null && existing.minute != null) {
      // Mismo minuto y lado pero nombres distintos: fuentes cruzadas (p. ej. scorers vs FIFA).
      if (goalEventRichness(event) > goalEventRichness(existing)) {
        result[existingIdx] = normalizeGoalEvent({ ...event });
      }
      continue;
    }

    if (goalEventRichness(event) > goalEventRichness(existing)) {
      result[existingIdx] = normalizeGoalEvent({ ...event });
    }
  }

  return result;
}

function timelineIncludesGoal(timeline, { side, minute, extraMinute = null, player }) {
  return timeline.some((event) => {
    if (event.type !== 'goal' || event.side !== side) return false;

    if (minute != null && event.minute != null) {
      if (Number(event.minute) !== Number(minute)) return false;
      const exA = Number(event.extraMinute ?? 0);
      const exB = Number(extraMinute ?? 0);
      return exA === exB;
    }

    if (minute != null || event.minute != null) return false;

    return (
      !player ||
      !event.player ||
      goalPlayerNamesMatch(event.player, player)
    );
  });
}

/** Completa goles faltantes desde goleadores o marcador oficial. */
export function completeTimelineEvents(
  timeline = [],
  { homeScorers = [], awayScorers = [], homeScore = 0, awayScore = 0 } = {}
) {
  const merged = timeline.map((event) => normalizeGoalEvent({ ...event }));

  const pushScorerGoal = (side, scorer) => {
    if (!scorer?.name) return;

    let name = String(scorer.name).trim();
    let minute = scorer.minute ?? null;
    let extraMinute = scorer.extraMinute ?? null;
    let isPenalty = Boolean(scorer.isPenalty);

    if (minute == null) {
      const parsed = parseScorerText(name);
      if (parsed.minute != null) {
        name = parsed.name;
        minute = parsed.minute;
        extraMinute = parsed.extraMinute ?? extraMinute;
        isPenalty = isPenalty || Boolean(parsed.isPenalty);
      }
    }

    if (timelineIncludesGoal(merged, { side, minute, extraMinute, player: name })) return;

    merged.push({
      sortKey: clockSortKeyFromParts(minute, extraMinute),
      minute,
      extraMinute,
      type: 'goal',
      side,
      player: name,
      playerPosition: scorer.position ?? null,
      playerIn: null,
      playerOut: null,
      ...(isPenalty ? { isPenalty: true } : {}),
    });
  };

  for (const scorer of homeScorers) {
    pushScorerGoal('home', scorer);
  }

  for (const scorer of awayScorers) {
    pushScorerGoal('away', scorer);
  }

  const deduped = deduplicateTimelineGoals(merged);

  return deduped.sort((a, b) => {
    const keyDiff = (a.sortKey ?? toSortKey(a.minute)) - (b.sortKey ?? toSortKey(b.minute));
    if (keyDiff !== 0) return keyDiff;
    return String(a.player ?? '').localeCompare(String(b.player ?? ''), 'es');
  });
}

export function buildTimelineFromLegacy(raw = {}, events = {}) {
  const timeline = [];

  for (const scorer of parseScorersField(raw.home_scorers ?? raw.homeScorers)) {
    timeline.push({
      sortKey: toSortKey(scorer.minute),
      minute: scorer.minute,
      extraMinute: null,
      type: 'goal',
      side: 'home',
      player: scorer.name,
      playerIn: null,
      playerOut: null,
    });
  }

  for (const scorer of parseScorersField(raw.away_scorers ?? raw.awayScorers)) {
    timeline.push({
      sortKey: toSortKey(scorer.minute),
      minute: scorer.minute,
      extraMinute: null,
      type: 'goal',
      side: 'away',
      player: scorer.name,
      playerIn: null,
      playerOut: null,
    });
  }

  const cardTypeMap = {
    YELLOW: 'yellow_card',
    RED: 'red_card',
    YELLOW_RED: 'red_card',
  };

  for (const booking of events.homeBookings ?? []) {
    timeline.push({
      sortKey: toSortKey(booking.minute),
      minute: booking.minute,
      extraMinute: null,
      type: cardTypeMap[String(booking.card ?? 'YELLOW').toUpperCase()] ?? 'yellow_card',
      side: 'home',
      player: booking.player,
      playerIn: null,
      playerOut: null,
    });
  }

  for (const booking of events.awayBookings ?? []) {
    timeline.push({
      sortKey: toSortKey(booking.minute),
      minute: booking.minute,
      extraMinute: null,
      type: cardTypeMap[String(booking.card ?? 'YELLOW').toUpperCase()] ?? 'yellow_card',
      side: 'away',
      player: booking.player,
      playerIn: null,
      playerOut: null,
    });
  }

  for (const substitution of events.homeSubstitutions ?? []) {
    timeline.push({
      sortKey: toSortKey(substitution.minute),
      minute: substitution.minute,
      extraMinute: null,
      type: 'substitution',
      side: 'home',
      player: substitution.playerIn,
      playerIn: substitution.playerIn,
      playerOut: substitution.playerOut,
    });
  }

  for (const substitution of events.awaySubstitutions ?? []) {
    timeline.push({
      sortKey: toSortKey(substitution.minute),
      minute: substitution.minute,
      extraMinute: null,
      type: 'substitution',
      side: 'away',
      player: substitution.playerIn,
      playerIn: substitution.playerIn,
      playerOut: substitution.playerOut,
    });
  }

  return timeline.sort((a, b) => a.sortKey - b.sortKey);
}

export function timelineHash(timeline = []) {
  return timeline
    .map((event) =>
      [
        event.type,
        event.side,
        event.minute,
        event.extraMinute,
        event.player,
        event.playerIn,
        event.playerOut,
      ].join(':')
    )
    .join('|');
}

export function readMatchTimeline(raw = {}) {
  const fifaTimeline = raw.fifaEvents?.timeline;
  if (Array.isArray(fifaTimeline) && fifaTimeline.length > 0) {
    return fifaTimeline;
  }

  const events = readStoredMatchEvents(raw);
  return buildTimelineFromLegacy(raw, events);
}

/** @param {Array<{ type?: string, side?: string }>} timeline */
export function goalCountsFromTimeline(timeline = []) {
  let home = 0;
  let away = 0;

  for (const event of timeline) {
    if (event.type !== 'goal') continue;
    if (event.side === 'home') home += 1;
    else if (event.side === 'away') away += 1;
  }

  return { home, away };
}

/** @param {Array<{ type?: string, side?: string, player?: string, playerPosition?: string | null, minute?: number | null }>} timeline */
export function scorersFromTimeline(timeline = []) {
  const home = [];
  const away = [];

  for (const event of timeline) {
    if (event.type !== 'goal' || !event.player) continue;
    const entry = {
      name: String(event.player).trim(),
      minute: event.minute ?? null,
      position: event.playerPosition ?? null,
      shirtNumber: event.playerShirtNumber ?? null,
      positionX: event.positionX ?? null,
      positionY: event.positionY ?? null,
    };
    if (event.side === 'home') home.push(entry);
    else if (event.side === 'away') away.push(entry);
  }

  return { home, away };
}

/** @param {Array<{ type?: string, side?: string, player?: string, playerPosition?: string | null, minute?: number | null }>} timeline */
export function bookingsFromTimeline(timeline = []) {
  const homeBookings = [];
  const awayBookings = [];

  for (const event of timeline) {
    if (!event.player) continue;

    let card = null;
    if (event.type === 'yellow_card') card = 'YELLOW';
    else if (event.type === 'red_card') card = 'RED';
    if (!card) continue;

    const entry = {
      minute: event.minute ?? null,
      player: String(event.player).trim(),
      card,
      position: event.playerPosition ?? null,
      shirtNumber: event.playerShirtNumber ?? null,
      positionX: event.positionX ?? null,
      positionY: event.positionY ?? null,
    };

    if (event.side === 'home') homeBookings.push(entry);
    else if (event.side === 'away') awayBookings.push(entry);
  }

  return { homeBookings, awayBookings };
}

/** @param {Array<{ type?: string, side?: string, playerIn?: string, playerOut?: string, playerInPosition?: string | null, playerOutPosition?: string | null, minute?: number | null, playerInPhotoUrl?: string | null, playerOutPhotoUrl?: string | null, playerInMongoId?: string | null, playerOutMongoId?: string | null, playerInExternalId?: string | null, playerOutExternalId?: string | null, playerInShirtNumber?: number | null, playerOutShirtNumber?: number | null, playerInPositionX?: number | null, playerInPositionY?: number | null, playerOutPositionX?: number | null, playerOutPositionY?: number | null }>} timeline */
export function substitutionsFromTimeline(timeline = []) {
  const homeSubstitutions = [];
  const awaySubstitutions = [];

  for (const event of timeline) {
    if (event.type !== 'substitution' || !event.playerIn || !event.playerOut) continue;

    const entry = {
      minute: event.minute ?? null,
      playerOut: String(event.playerOut).trim(),
      playerIn: String(event.playerIn).trim(),
      playerOutPosition: event.playerOutPosition ?? null,
      playerInPosition: event.playerInPosition ?? null,
      playerOutShirtNumber: event.playerOutShirtNumber ?? null,
      playerInShirtNumber: event.playerInShirtNumber ?? null,
      playerOutPositionX: event.playerOutPositionX ?? event.positionX ?? null,
      playerOutPositionY: event.playerOutPositionY ?? event.positionY ?? null,
      playerInPositionX: event.playerInPositionX ?? event.positionX ?? null,
      playerInPositionY: event.playerInPositionY ?? event.positionY ?? null,
      playerOutPhotoUrl: event.playerOutPhotoUrl ?? null,
      playerInPhotoUrl: event.playerInPhotoUrl ?? null,
      playerOutMongoId: event.playerOutMongoId ?? null,
      playerInMongoId: event.playerInMongoId ?? null,
      playerOutExternalId: event.playerOutExternalId ?? null,
      playerInExternalId: event.playerInExternalId ?? null,
      idPlayerOut: event.idPlayerOut ?? null,
      idPlayerIn: event.idPlayerIn ?? null,
    };

    if (event.side === 'home') homeSubstitutions.push(entry);
    else if (event.side === 'away') awaySubstitutions.push(entry);
  }

  return { homeSubstitutions, awaySubstitutions };
}

/** @param {Array<Record<string, unknown>>} substitutions @param {Array<{ fullName?: string, photoUrl?: string | null, shirtNumber?: number | null, mongoId?: string | null, externalId?: string | null, position?: string | null }>} roster */
export function enrichSubstitutionsFromRoster(substitutions = [], roster = []) {
  return substitutions.map((sub) => {
    const out = enrichNameFromRoster(sub.playerOut, roster, {
      shirtNumber: sub.playerOutShirtNumber ?? null,
    });
    const incoming = enrichNameFromRoster(sub.playerIn, roster, {
      shirtNumber: sub.playerInShirtNumber ?? null,
    });

    return {
      ...sub,
      playerOut: out.name || sub.playerOut,
      playerIn: incoming.name || sub.playerIn,
      playerOutPosition: sub.playerOutPosition ?? out.position ?? null,
      playerInPosition: sub.playerInPosition ?? incoming.position ?? null,
      playerOutShirtNumber: sub.playerOutShirtNumber ?? out.shirtNumber ?? null,
      playerInShirtNumber: sub.playerInShirtNumber ?? incoming.shirtNumber ?? null,
      playerOutPhotoUrl: sub.playerOutPhotoUrl ?? out.photoUrl ?? null,
      playerInPhotoUrl: sub.playerInPhotoUrl ?? incoming.photoUrl ?? null,
      playerOutMongoId: sub.playerOutMongoId ?? out.mongoId ?? null,
      playerInMongoId: sub.playerInMongoId ?? incoming.mongoId ?? null,
      playerOutExternalId: sub.playerOutExternalId ?? out.externalId ?? null,
      playerInExternalId: sub.playerInExternalId ?? incoming.externalId ?? null,
    };
  });
}

/** @param {Array<{ minute?: number | null, sortKey?: number }>} timeline */
export function latestMinuteFromTimeline(timeline = []) {
  let latest = null;

  for (const event of timeline) {
    if (event.minute != null && Number.isFinite(Number(event.minute))) {
      latest = latest == null ? Number(event.minute) : Math.max(latest, Number(event.minute));
      continue;
    }

    if (event.sortKey != null && Number.isFinite(Number(event.sortKey))) {
      const minute = Math.floor(Number(event.sortKey));
      latest = latest == null ? minute : Math.max(latest, minute);
    }
  }

  return latest;
}

/**
 * Marcador oficial FIFA guardado en fifaMeta (refleja goles anulados).
 * @param {Record<string, unknown>} raw
 */
export function readFifaAuthoritativeScores(raw = {}) {
  const meta = raw.fifaMeta ?? {};
  const homeScore = Number(meta.homeScore);
  const awayScore = Number(meta.awayScore);

  if (!meta.syncedAt || !Number.isFinite(homeScore) || !Number.isFinite(awayScore)) {
    return null;
  }

  if (!isPlausibleMatchGoalCount(homeScore) || !isPlausibleMatchGoalCount(awayScore)) {
    return null;
  }

  return { homeScore, awayScore };
}

/**
 * @param {{ homeScore?: number | null, awayScore?: number | null }} match
 * @param {Array<{ type?: string, side?: string }>} timeline
 * @param {Record<string, unknown>} raw
 */
export function resolveEffectiveLiveScores(match, timeline = [], raw = {}) {
  const { home: timelineHome, away: timelineAway } = goalCountsFromTimeline(timeline);
  const fifaScores = readFifaAuthoritativeScores(raw);

  if (match.status === 'finished') {
    return {
      homeScore: sanitizeMatchGoalCount(
        match.homeScore,
        fifaScores?.homeScore ?? timelineHome
      ),
      awayScore: sanitizeMatchGoalCount(
        match.awayScore,
        fifaScores?.awayScore ?? timelineAway
      ),
    };
  }

  if (fifaScores) {
    // fifaMeta refleja goles anulados; si la cronología tiene más goles, el Score FIFA va retrasado.
    const homeScore =
      timelineHome > fifaScores.homeScore
        ? mergePlausibleGoalCounts(fifaScores.homeScore, timelineHome, match.homeScore)
        : fifaScores.homeScore;
    const awayScore =
      timelineAway > fifaScores.awayScore
        ? mergePlausibleGoalCounts(fifaScores.awayScore, timelineAway, match.awayScore)
        : fifaScores.awayScore;
    return { homeScore, awayScore };
  }

  return {
    homeScore: mergePlausibleGoalCounts(match.homeScore, timelineHome),
    awayScore: mergePlausibleGoalCounts(match.awayScore, timelineAway),
  };
}

/** Combina Score FIFA API con goles en cronología (API puede ir retrasada en vivo). */
export function mergeFifaApiScoreWithTimeline(fifaHome, fifaAway, timeline = [], hasFifaScore = true) {
  const { home, away } = goalCountsFromTimeline(timeline);
  if (!hasFifaScore) {
    return { homeScore: home, awayScore: away };
  }
  return {
    homeScore: mergePlausibleGoalCounts(fifaHome, home),
    awayScore: mergePlausibleGoalCounts(fifaAway, away),
  };
}

function pickNonEmptyList(primary = [], fallback = []) {
  return primary.length > 0 ? primary : fallback;
}

function timelineCoordKey(event) {
  return [
    event.type,
    event.side ?? '',
    event.minute ?? '',
    event.extraMinute ?? '',
    event.player ?? '',
    event.playerIn ?? '',
    event.playerOut ?? '',
  ].join('|');
}

/** @param {Array<Record<string, unknown>>} timeline */
export function attachTimelinePitchCoords(timeline, rawEvents, homeTeamId, awayTeamId) {
  if (!Array.isArray(timeline) || timeline.length === 0) return timeline;
  if (!Array.isArray(rawEvents) || rawEvents.length === 0) return timeline;
  if (!homeTeamId || !awayTeamId) return timeline;

  const coordByKey = new Map();
  for (const rawEvent of rawEvents) {
    const entry = buildFifaTimelineEntry(rawEvent, homeTeamId, awayTeamId);
    if (!entry || entry.positionX == null || entry.positionY == null) continue;
    coordByKey.set(timelineCoordKey(entry), {
      positionX: entry.positionX,
      positionY: entry.positionY,
    });
  }

  if (coordByKey.size === 0) return timeline;

  return timeline.map((event) => {
    if (event.positionX != null && event.positionY != null) return event;
    const coords = coordByKey.get(timelineCoordKey(event));
    if (!coords) return event;
    return { ...event, ...coords };
  });
}

function timelineChronologicalSortKey(event) {
  if (event?.sortKey != null) {
    const key = Number(event.sortKey);
    if (Number.isFinite(key)) return key;
  }
  if (event?.minute == null || !Number.isFinite(Number(event.minute))) {
    return Number.POSITIVE_INFINITY;
  }
  const minute = Number(event.minute);
  const extra = Number(event.extraMinute ?? 0);
  return minute + extra / 100;
}

/** @param {Record<string, unknown>} event @param {'player' | 'in' | 'out'} role */
export function playerGoalCountKey(event, role = 'player') {
  const idKey = role === 'player' ? 'idPlayer' : role === 'in' ? 'idPlayerIn' : 'idPlayerOut';
  const nameKey = role === 'player' ? 'player' : role === 'in' ? 'playerIn' : 'playerOut';
  const id = event?.[idKey];
  if (id != null && String(id).trim()) return `id:${String(id)}`;
  const name = event?.[nameKey];
  if (name) return `name:${normalizeName(name)}`;
  return null;
}

/**
 * Cuenta goles por jugador en partidos finalizados (excluye el partido actual).
 * @param {Array<{ externalId?: string, raw?: Record<string, unknown> | null }>} finishedMatches
 * @param {string | null | undefined} excludeExternalId
 */
/**
 * Agrega goles por jugador desde partidos finalizados sin retener documentos Mongo completos.
 * @returns {{ globalCounts: Map<string, number>, goalsByExternalId: Map<string, Map<string, number>> }}
 */
export function buildTournamentGoalCountsBundle(finishedMatches = []) {
  const globalCounts = new Map();
  const goalsByExternalId = new Map();

  for (const match of finishedMatches) {
    const matchGoals = new Map();
    const timeline = readMatchTimeline(match.raw ?? {});
    for (const event of timeline) {
      if (event.type !== 'goal' || !event.player) continue;
      const key = playerGoalCountKey(event, 'player');
      if (!key) continue;
      matchGoals.set(key, (matchGoals.get(key) ?? 0) + 1);
      globalCounts.set(key, (globalCounts.get(key) ?? 0) + 1);
    }
    if (match.externalId) {
      goalsByExternalId.set(match.externalId, matchGoals);
    }
  }

  return { globalCounts, goalsByExternalId };
}

/** Prior counts desde bundle compacto (menos RAM que arrays de partidos con raw completo). */
export function createPriorTournamentGoalCountsResolverFromBundle(bundle) {
  const { globalCounts, goalsByExternalId } = bundle ?? {
    globalCounts: new Map(),
    goalsByExternalId: new Map(),
  };
  const byExcludeExternalId = new Map();

  return function resolvePriorTournamentGoalCounts(excludeExternalId, status) {
    if (status === 'live') {
      return globalCounts;
    }
    const key = excludeExternalId ?? '';
    if (!byExcludeExternalId.has(key)) {
      const excludeGoals = goalsByExternalId.get(key);
      if (!excludeGoals?.size) {
        byExcludeExternalId.set(key, globalCounts);
      } else {
        const counts = new Map(globalCounts);
        for (const [playerKey, n] of excludeGoals) {
          const next = (counts.get(playerKey) ?? 0) - n;
          if (next <= 0) counts.delete(playerKey);
          else counts.set(playerKey, next);
        }
        byExcludeExternalId.set(key, counts);
      }
    }
    return byExcludeExternalId.get(key);
  };
}

export function priorTournamentGoalCountsForMatch(bundle, excludeExternalId) {
  return createPriorTournamentGoalCountsResolverFromBundle(bundle)(
    excludeExternalId,
    'finished'
  );
}

/** Memoiza prior counts por partido en un mismo enrich (live comparte un mapa). */
export function createPriorTournamentGoalCountsResolver(finishedMatches = []) {
  let liveCounts = null;
  const byExcludeExternalId = new Map();

  return function resolvePriorTournamentGoalCounts(excludeExternalId, status) {
    if (status === 'live') {
      if (!liveCounts) {
        liveCounts = buildPriorTournamentGoalCounts(finishedMatches, null);
      }
      return liveCounts;
    }
    const key = excludeExternalId ?? '';
    if (!byExcludeExternalId.has(key)) {
      byExcludeExternalId.set(
        key,
        buildPriorTournamentGoalCounts(finishedMatches, excludeExternalId || null)
      );
    }
    return byExcludeExternalId.get(key);
  };
}

export function buildPriorTournamentGoalCounts(finishedMatches = [], excludeExternalId = null) {
  const counts = new Map();

  for (const match of finishedMatches) {
    if (excludeExternalId && match.externalId === excludeExternalId) continue;
    const timeline = readMatchTimeline(match.raw ?? {});
    for (const event of timeline) {
      if (event.type !== 'goal' || !event.player) continue;
      const key = playerGoalCountKey(event, 'player');
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return counts;
}

/** Clave estable para deduplicar goles en timeline y push. */
export function buildTimelineGoalKey(event = {}) {
  return [
    event.type ?? 'goal',
    event.side ?? '',
    event.minute ?? '',
    event.extraMinute ?? '',
    event.player ?? '',
  ].join(':');
}

/** Goles presentes en `newTimeline` que no estaban en `oldTimeline`. */
export function findNewTimelineGoals(oldTimeline = [], newTimeline = []) {
  const oldKeys = new Set(
    oldTimeline.filter((event) => event.type === 'goal').map((event) => buildTimelineGoalKey(event))
  );
  return newTimeline.filter(
    (event) => event.type === 'goal' && !oldKeys.has(buildTimelineGoalKey(event))
  );
}

/**
 * Adjunta goles acumulados del torneo a cada evento con jugador.
 * @param {Array<Record<string, unknown>>} timeline
 * @param {Map<string, number>} priorCounts
 */
export function attachTimelineTournamentGoals(timeline = [], priorCounts = new Map()) {
  if (!timeline.length) return timeline;

  const running = new Map(priorCounts);
  const chronological = [...timeline].sort(
    (a, b) => timelineChronologicalSortKey(a) - timelineChronologicalSortKey(b)
  );
  const enrichedByIdentity = new Map();

  for (const event of chronological) {
    const next = { ...event };

    const attachRole = (role, fieldName) => {
      const key = playerGoalCountKey(event, role);
      if (!key) return;
      const prior = running.get(key) ?? 0;
      const isScorerGoal = event.type === 'goal' && role === 'player';
      const total = isScorerGoal ? prior + 1 : prior;
      if (total > 0) next[fieldName] = total;
      if (isScorerGoal) running.set(key, total);
    };

    if (next.player) attachRole('player', 'playerTournamentGoals');
    if (next.playerIn) attachRole('in', 'playerInTournamentGoals');
    if (next.playerOut) attachRole('out', 'playerOutTournamentGoals');

    enrichedByIdentity.set(
      [
        event.type,
        event.side,
        event.minute,
        event.extraMinute ?? '',
        event.player ?? '',
        event.playerIn ?? '',
        event.playerOut ?? '',
      ].join(':'),
      next
    );
  }

  return timeline.map((event) => {
    const identity = [
      event.type,
      event.side,
      event.minute,
      event.extraMinute ?? '',
      event.player ?? '',
      event.playerIn ?? '',
      event.playerOut ?? '',
    ].join(':');
    return enrichedByIdentity.get(identity) ?? event;
  });
}

/** @param {Array<Record<string, unknown>>} timeline */
export function enrichTimelineRosterFields(timeline, homePlayers = [], awayPlayers = []) {
  return timeline.map((event) => {
    const roster =
      event.side === 'home' ? homePlayers : event.side === 'away' ? awayPlayers : [];
    const next = { ...event };

    if (next.player) {
      const enriched = enrichNameFromRoster(next.player, roster, {
        shirtNumber: next.playerShirtNumber ?? null,
      });
      next.player = enriched.name;
      next.playerPosition = next.playerPosition ?? enriched.position ?? null;
      next.playerShirtNumber = next.playerShirtNumber ?? enriched.shirtNumber ?? null;
      if (enriched.photoUrl) next.playerPhotoUrl = enriched.photoUrl;
      if (enriched.mongoId) next.playerMongoId = enriched.mongoId;
      if (enriched.externalId) next.playerExternalId = enriched.externalId;
    }
    if (next.playerIn) {
      const enriched = enrichNameFromRoster(next.playerIn, roster, {
        shirtNumber: next.playerInShirtNumber ?? null,
      });
      next.playerIn = enriched.name;
      next.playerInPosition = next.playerInPosition ?? enriched.position ?? null;
      next.playerInShirtNumber = next.playerInShirtNumber ?? enriched.shirtNumber ?? null;
      if (enriched.photoUrl) next.playerInPhotoUrl = enriched.photoUrl;
      if (enriched.mongoId) next.playerInMongoId = enriched.mongoId;
      if (enriched.externalId) next.playerInExternalId = enriched.externalId;
    }
    if (next.playerOut) {
      const enriched = enrichNameFromRoster(next.playerOut, roster, {
        shirtNumber: next.playerOutShirtNumber ?? null,
      });
      next.playerOut = enriched.name;
      next.playerOutPosition = next.playerOutPosition ?? enriched.position ?? null;
      next.playerOutShirtNumber = next.playerOutShirtNumber ?? enriched.shirtNumber ?? null;
      if (enriched.photoUrl) next.playerOutPhotoUrl = enriched.photoUrl;
      if (enriched.mongoId) next.playerOutMongoId = enriched.mongoId;
      if (enriched.externalId) next.playerOutExternalId = enriched.externalId;
    }

    return next;
  });
}

/**
 * @param {{ status?: string, homeScore?: number | null, awayScore?: number | null, raw?: Record<string, unknown> | null }} match
 * @param {{ homePlayers?: Array<{ fullName: string, position?: string, shirtNumber?: number }>, awayPlayers?: Array<{ fullName: string, position?: string, shirtNumber?: number }>, priorTournamentGoalCounts?: Map<string, number> }} [options]
 */
export function enrichMatchLiveFields(match, options = {}) {
  const raw = match.raw ?? {};
  const showResults = match.status === 'live' || match.status === 'finished';
  const events = readStoredMatchEvents(raw);
  const { homePlayers = [], awayPlayers = [], priorTournamentGoalCounts } = options;
  const mappedHomePlayers = homePlayers.map(mapPlayerToTimelineRosterEntry);
  const mappedAwayPlayers = awayPlayers.map(mapPlayerToTimelineRosterEntry);
  let baseTimeline = showResults ? readMatchTimeline(raw) : [];

  if (showResults && baseTimeline.length > 0) {
    const homeTeamId = raw.fifaMeta?.homeTeamId;
    const awayTeamId = raw.fifaMeta?.awayTeamId;
    const rawEvents = raw.fifaEvents?.rawEvents;

    baseTimeline = attachTimelinePlayerIds(baseTimeline, rawEvents, homeTeamId, awayTeamId);
    baseTimeline = attachTimelinePitchCoords(baseTimeline, rawEvents, homeTeamId, awayTeamId);
    baseTimeline = mergeShotAttemptsFromRawEvents(
      baseTimeline,
      rawEvents,
      homeTeamId,
      awayTeamId
    );
    baseTimeline = dedupeTimelineBySlot(baseTimeline);
    baseTimeline = applyShirtNumbersToTimeline(baseTimeline, {
      shirtByPlayerId: raw.fifaMeta?.shirtByPlayerId ?? {},
      shirtBySideName: raw.fifaMeta?.shirtBySideName ?? {},
    });
    if (mappedHomePlayers.length > 0 || mappedAwayPlayers.length > 0) {
      baseTimeline = enrichTimelineRosterFields(baseTimeline, mappedHomePlayers, mappedAwayPlayers);
    }
  }
  const parsedHomeScorers = parseScorersField(raw.home_scorers ?? raw.homeScorers);
  const parsedAwayScorers = parseScorersField(raw.away_scorers ?? raw.awayScorers);
  const scoreSeed = showResults
    ? resolveEffectiveLiveScores(match, baseTimeline, raw)
    : { homeScore: match.homeScore ?? 0, awayScore: match.awayScore ?? 0 };

  let matchTimeline = showResults
    ? completeTimelineEvents(baseTimeline, {
        homeScorers: parsedHomeScorers,
        awayScorers: parsedAwayScorers,
        homeScore: scoreSeed.homeScore,
        awayScore: scoreSeed.awayScore,
      })
    : [];

  if (showResults && matchTimeline.length > 0 && priorTournamentGoalCounts) {
    matchTimeline = attachTimelineTournamentGoals(matchTimeline, priorTournamentGoalCounts);
  }

  const effectiveScores = showResults
    ? resolveEffectiveLiveScores(match, matchTimeline, raw)
    : scoreSeed;
  const timelineScorers = scorersFromTimeline(matchTimeline);
  const timelineBookings = bookingsFromTimeline(matchTimeline);
  const timelineSubstitutions = substitutionsFromTimeline(matchTimeline);

  const homeScorers = showResults
    ? pickNonEmptyList(parsedHomeScorers, timelineScorers.home)
    : [];
  const awayScorers = showResults
    ? pickNonEmptyList(parsedAwayScorers, timelineScorers.away)
    : [];

  const homeBookings = showResults
    ? pickNonEmptyList(events.homeBookings, timelineBookings.homeBookings)
    : [];
  const awayBookings = showResults
    ? pickNonEmptyList(events.awayBookings, timelineBookings.awayBookings)
    : [];
  const homeSubstitutions = showResults
    ? enrichSubstitutionsFromRoster(
        pickNonEmptyList(timelineSubstitutions.homeSubstitutions, events.homeSubstitutions),
        mappedHomePlayers
      )
    : [];
  const awaySubstitutions = showResults
    ? enrichSubstitutionsFromRoster(
        pickNonEmptyList(timelineSubstitutions.awaySubstitutions, events.awaySubstitutions),
        mappedAwayPlayers
      )
    : [];

  const matchPlayState = serializeMatchPlayStateForClient(
    resolveMatchPlayState(match, { timeline: matchTimeline, raw })
  );

  let timeElapsed =
    match.status === 'live'
      ? resolveLiveMatchDisplayClock({ ...match, matchPlayState }, matchTimeline, raw)
      : match.status === 'finished'
        ? 'Final'
        : null;

  return {
    timeElapsed,
    matchPlayState,
    homeScore: effectiveScores.homeScore,
    awayScore: effectiveScores.awayScore,
    homeScorers,
    awayScorers,
    homeBookings,
    awayBookings,
    homeSubstitutions,
    awaySubstitutions,
    matchTimeline,
    fifaReportStats: showResults ? (raw.fifaReportStats ?? null) : null,
  };
}
