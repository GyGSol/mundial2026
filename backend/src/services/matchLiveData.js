/** @typedef {{ name: string, minute: number | null }} MatchScorer */

export function isNullishScorerValue(value) {
  if (value == null) return true;
  const normalized = String(value).trim().toLowerCase();
  return normalized === '' || normalized === 'null' || normalized === 'undefined';
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
export function parseScorersField(value) {
  if (isNullishScorerValue(value)) return [];

  if (Array.isArray(value)) {
    return value.map(normalizeScorerEntry).filter(Boolean);
  }

  const trimmed = String(value).trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    const quoted = [...trimmed.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
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

  return {
    timeElapsed: match.status === 'live' ? formatTimeElapsed(raw) : null,
    homeScorers: showResults ? parseScorersField(raw.home_scorers ?? raw.homeScorers) : [],
    awayScorers: showResults ? parseScorersField(raw.away_scorers ?? raw.awayScorers) : [],
  };
}
