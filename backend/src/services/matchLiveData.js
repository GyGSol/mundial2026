/** @typedef {{ name: string, minute: number | null }} MatchScorer */
/** @typedef {{ minute: number | null, player: string, card: string }} MatchBooking */
/** @typedef {{ minute: number | null, playerOut: string, playerIn: string }} MatchSubstitution */

import { buildFifaTimelineEntry } from './fifaTimelineParser.js';
import { enrichNameFromRoster } from '../utils/playerNameMatch.js';

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
 * @param {unknown} entry
 * @returns {MatchScorer | null}
 */
function normalizeScorerEntry(entry) {
  if (typeof entry === 'string') {
    const trimmed = entry.trim();
    if (!trimmed || isNullishScorerValue(trimmed)) return null;

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

  if (entry && typeof entry === 'object') {
    const record = /** @type {Record<string, unknown>} */ (entry);
    const name = record.name ?? record.player ?? record.scorer ?? record.player_name;
    if (!name) return null;

    const minuteRaw = record.minute ?? record.time ?? record.min ?? record.elapsed;
    const minute =
      minuteRaw == null || minuteRaw === ''
        ? null
        : Number.isFinite(Number(minuteRaw))
          ? Number(minuteRaw)
          : null;

    return { name: String(name).trim(), minute };
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
  if (fromApi === 'Entretiempo' || fromApi === 'Final') return fromApi;

  return parseElapsedClockToSortKey(fromTimeline) >= parseElapsedClockToSortKey(fromApi)
    ? fromTimeline
    : fromApi;
}


function toSortKey(minute) {
  if (minute == null || !Number.isFinite(Number(minute))) return Number.POSITIVE_INFINITY;
  return Number(minute);
}

function normalizeGoalPlayer(name) {
  return String(name ?? '').trim().toLowerCase();
}

function timelineIncludesGoal(timeline, { side, minute, player }) {
  return timeline.some((event) => {
    if (event.type !== 'goal' || event.side !== side) return false;

    const sameMinute =
      minute == null || event.minute == null || Number(event.minute) === Number(minute);
    const samePlayer =
      !player ||
      !event.player ||
      normalizeGoalPlayer(event.player) === normalizeGoalPlayer(player);

    return sameMinute && samePlayer;
  });
}

/** Completa goles faltantes desde goleadores o marcador oficial. */
export function completeTimelineEvents(
  timeline = [],
  { homeScorers = [], awayScorers = [], homeScore = 0, awayScore = 0 } = {}
) {
  const merged = timeline.map((event) => ({ ...event }));

  for (const scorer of homeScorers) {
    if (!scorer?.name) continue;
    if (timelineIncludesGoal(merged, { side: 'home', minute: scorer.minute, player: scorer.name })) {
      continue;
    }
    merged.push({
      sortKey: toSortKey(scorer.minute),
      minute: scorer.minute ?? null,
      extraMinute: null,
      type: 'goal',
      side: 'home',
      player: scorer.name,
      playerPosition: scorer.position ?? null,
      playerIn: null,
      playerOut: null,
    });
  }

  for (const scorer of awayScorers) {
    if (!scorer?.name) continue;
    if (timelineIncludesGoal(merged, { side: 'away', minute: scorer.minute, player: scorer.name })) {
      continue;
    }
    merged.push({
      sortKey: toSortKey(scorer.minute),
      minute: scorer.minute ?? null,
      extraMinute: null,
      type: 'goal',
      side: 'away',
      player: scorer.name,
      playerPosition: scorer.position ?? null,
      playerIn: null,
      playerOut: null,
    });
  }

  let { home, away } = goalCountsFromTimeline(merged);
  let placeholderIndex = 0;

  while (home < Number(homeScore ?? 0)) {
    merged.push({
      sortKey: Number.POSITIVE_INFINITY - placeholderIndex,
      minute: null,
      extraMinute: null,
      type: 'goal',
      side: 'home',
      player: null,
      playerIn: null,
      playerOut: null,
    });
    home += 1;
    placeholderIndex += 1;
  }

  while (away < Number(awayScore ?? 0)) {
    merged.push({
      sortKey: Number.POSITIVE_INFINITY - placeholderIndex,
      minute: null,
      extraMinute: null,
      type: 'goal',
      side: 'away',
      player: null,
      playerIn: null,
      playerOut: null,
    });
    away += 1;
    placeholderIndex += 1;
  }

  return merged.sort((a, b) => {
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

/** @param {Array<{ type?: string, side?: string, playerIn?: string, playerOut?: string, playerInPosition?: string | null, playerOutPosition?: string | null, minute?: number | null }>} timeline */
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
      playerOutPositionX: event.positionX ?? null,
      playerOutPositionY: event.positionY ?? null,
      playerInPositionX: event.positionX ?? null,
      playerInPositionY: event.positionY ?? null,
    };

    if (event.side === 'home') homeSubstitutions.push(entry);
    else if (event.side === 'away') awaySubstitutions.push(entry);
  }

  return { homeSubstitutions, awaySubstitutions };
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

  return { homeScore, awayScore };
}

/**
 * @param {{ homeScore?: number | null, awayScore?: number | null }} match
 * @param {Array<{ type?: string, side?: string }>} timeline
 * @param {Record<string, unknown>} raw
 */
export function resolveEffectiveLiveScores(match, timeline = [], raw = {}) {
  const fifaScores = readFifaAuthoritativeScores(raw);
  if (fifaScores) return fifaScores;

  const { home, away } = goalCountsFromTimeline(timeline);

  return {
    homeScore: Math.max(Number(match.homeScore ?? 0), home),
    awayScore: Math.max(Number(match.awayScore ?? 0), away),
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

/** @param {Array<Record<string, unknown>>} timeline */
export function enrichTimelineRosterFields(timeline, homePlayers = [], awayPlayers = []) {
  return timeline.map((event) => {
    const roster =
      event.side === 'home' ? homePlayers : event.side === 'away' ? awayPlayers : [];
    const next = { ...event };

    if (next.player) {
      const enriched = enrichNameFromRoster(next.player, roster);
      next.player = enriched.name;
      next.playerPosition = next.playerPosition ?? enriched.position ?? null;
      next.playerShirtNumber = next.playerShirtNumber ?? enriched.shirtNumber ?? null;
    }
    if (next.playerIn) {
      const enriched = enrichNameFromRoster(next.playerIn, roster);
      next.playerIn = enriched.name;
      next.playerInPosition = next.playerInPosition ?? enriched.position ?? null;
      next.playerInShirtNumber = next.playerInShirtNumber ?? enriched.shirtNumber ?? null;
    }
    if (next.playerOut) {
      const enriched = enrichNameFromRoster(next.playerOut, roster);
      next.playerOut = enriched.name;
      next.playerOutPosition = next.playerOutPosition ?? enriched.position ?? null;
      next.playerOutShirtNumber = next.playerOutShirtNumber ?? enriched.shirtNumber ?? null;
    }

    return next;
  });
}

/**
 * @param {{ status?: string, homeScore?: number | null, awayScore?: number | null, raw?: Record<string, unknown> | null }} match
 * @param {{ homePlayers?: Array<{ fullName: string, position?: string, shirtNumber?: number }>, awayPlayers?: Array<{ fullName: string, position?: string, shirtNumber?: number }> }} [options]
 */
export function enrichMatchLiveFields(match, options = {}) {
  const raw = match.raw ?? {};
  const showResults = match.status === 'live' || match.status === 'finished';
  const events = readStoredMatchEvents(raw);
  const { homePlayers = [], awayPlayers = [] } = options;
  let baseTimeline = showResults ? readMatchTimeline(raw) : [];

  if (showResults && baseTimeline.length > 0) {
    baseTimeline = attachTimelinePitchCoords(
      baseTimeline,
      raw.fifaEvents?.rawEvents,
      raw.fifaMeta?.homeTeamId,
      raw.fifaMeta?.awayTeamId
    );
    if (homePlayers.length > 0 || awayPlayers.length > 0) {
      baseTimeline = enrichTimelineRosterFields(baseTimeline, homePlayers, awayPlayers);
    }
  }
  const baseTimelineScorers = scorersFromTimeline(baseTimeline);
  const parsedHomeScorers = parseScorersField(raw.home_scorers ?? raw.homeScorers);
  const parsedAwayScorers = parseScorersField(raw.away_scorers ?? raw.awayScorers);
  const effectiveScores = showResults
    ? resolveEffectiveLiveScores(match, baseTimeline, raw)
    : { homeScore: match.homeScore ?? 0, awayScore: match.awayScore ?? 0 };

  const matchTimeline = showResults
    ? completeTimelineEvents(baseTimeline, {
        homeScorers: pickNonEmptyList(parsedHomeScorers, baseTimelineScorers.home),
        awayScorers: pickNonEmptyList(parsedAwayScorers, baseTimelineScorers.away),
        homeScore: effectiveScores.homeScore,
        awayScore: effectiveScores.awayScore,
      })
    : [];
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
    ? pickNonEmptyList(events.homeSubstitutions, timelineSubstitutions.homeSubstitutions)
    : [];
  const awaySubstitutions = showResults
    ? pickNonEmptyList(events.awaySubstitutions, timelineSubstitutions.awaySubstitutions)
    : [];

  let timeElapsed =
    match.status === 'live'
      ? resolveLiveTimeElapsed(raw, matchTimeline)
      : match.status === 'finished'
        ? 'Final'
        : null;

  return {
    timeElapsed,
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
