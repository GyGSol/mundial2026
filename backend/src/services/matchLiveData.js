/** @typedef {{ name: string, minute: number | null }} MatchScorer */
/** @typedef {{ minute: number | null, player: string, card: string }} MatchBooking */
/** @typedef {{ minute: number | null, playerOut: string, playerIn: string }} MatchSubstitution */

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
  const apiFootballEvents = raw.apiFootballEvents ?? {};
  const wcEvents = readWorldCupApiEvents(raw);

  return mergeMatchEvents(mergeMatchEvents(fdEvents, apiFootballEvents), wcEvents);
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
  if (normalized === 'ht' || normalized === 'halftime') return 'ET';

  if (/^\d+\+\d+$/.test(normalized)) {
    return `${normalized}'`;
  }

  const minute = Number(normalized);
  if (Number.isFinite(minute) && minute > 0) {
    return `${minute}'`;
  }

  return normalized;
}

/**
 * @param {{ status?: string, raw?: Record<string, unknown> | null }} match
 */
export function enrichMatchLiveFields(match) {
  const raw = match.raw ?? {};
  const showResults = match.status === 'live' || match.status === 'finished';
  const events = readStoredMatchEvents(raw);

  return {
    timeElapsed:
      match.status === 'live'
        ? formatTimeElapsed(raw)
        : match.status === 'finished'
          ? 'Final'
          : null,
    homeScorers: showResults ? parseScorersField(raw.home_scorers ?? raw.homeScorers) : [],
    awayScorers: showResults ? parseScorersField(raw.away_scorers ?? raw.awayScorers) : [],
    homeBookings: showResults ? events.homeBookings : [],
    awayBookings: showResults ? events.awayBookings : [],
    homeSubstitutions: showResults ? events.homeSubstitutions : [],
    awaySubstitutions: showResults ? events.awaySubstitutions : [],
  };
}
