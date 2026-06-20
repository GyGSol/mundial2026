import { env } from '../config/env.js';
import { resolveStadiumTimezone } from './stadiumTimezones.js';
import { fetchWithRetry } from './worldCupApiClient.js';

export const ARGENTINA_TIMEZONE = 'America/Argentina/Buenos_Aires';

const DEFAULT_HEADERS = {
  Accept: 'application/json',
  'Accept-Language': 'en-GB',
};

async function fifaRequest(path, { searchParams } = {}) {
  const base = env.fifaApiUrl.replace(/\/$/, '');
  const url = new URL(`${base}${path}`);
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value != null && value !== '') url.searchParams.set(key, String(value));
    }
  }

  const res = await fetchWithRetry(url, { headers: DEFAULT_HEADERS });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`FIFA API ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json();
}

function localizedText(entry, field = 'Description') {
  const list = entry?.[field] ?? entry;
  if (Array.isArray(list)) {
    return list.find((item) => item.Locale === 'en-GB')?.Description ?? list[0]?.Description ?? '';
  }
  return String(list ?? '');
}

export function extractTeamAbbreviation(teamSide) {
  return (
    teamSide?.Abbreviation ??
    teamSide?.IdCountry ??
    localizedText(teamSide?.TeamName) ??
    ''
  );
}


export function extractStadiumName(entry) {
  const stadium = entry?.Stadium;
  if (!stadium) return '';
  const names = stadium.Name ?? stadium.name;
  if (Array.isArray(names)) {
    return names.find((item) => item.Locale === 'en-GB')?.Description ?? names[0]?.Description ?? '';
  }
  return localizedText(stadium);
}

/** FIFA LocalDate: wall-clock at stadium with misleading Z suffix — not UTC. */
export function parseFifaLocalDateWallClock(localDateStr) {
  const raw = String(localDateStr || '').trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return null;

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  };
}

function normalizeWallClockHour(hour) {
  return hour === 24 ? 0 : hour;
}

export function readWallClockInTimezone(utcMs, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });

  const chunk = Object.fromEntries(
    formatter
      .formatToParts(new Date(utcMs))
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, Number(p.value)])
  );

  return {
    year: chunk.year,
    month: chunk.month,
    day: chunk.day,
    hour: normalizeWallClockHour(chunk.hour),
    minute: chunk.minute,
  };
}

/** FIFA Date (UTC) → ART wall clock "YYYY-MM-DDTHH:mm". */
export function fifaDateToArtIso(dateUtc, timeZone = ARGENTINA_TIMEZONE) {
  const date = dateUtc instanceof Date ? dateUtc : new Date(dateUtc);
  if (Number.isNaN(date.getTime())) return null;

  const parts = readWallClockInTimezone(date.getTime(), timeZone);
  const pad = (n) => String(n).padStart(2, '0');
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

function wallClockPartsEqual(a, b) {
  if (!a || !b) return false;
  return (
    a.year === b.year &&
    a.month === b.month &&
    a.day === b.day &&
    a.hour === b.hour &&
    a.minute === b.minute
  );
}

/** Cross-check FIFA Date (UTC) vs LocalDate (stadium wall clock). */
export function validateFifaKickoffConsistency(entry, stadiumTimezone) {
  if (!entry?.Date || !entry?.LocalDate) {
    return { ok: true, skipped: true, reason: 'missing Date or LocalDate' };
  }
  if (!stadiumTimezone) {
    return { ok: true, skipped: true, reason: 'unknown stadium timezone' };
  }

  const utcMs = new Date(entry.Date).getTime();
  if (Number.isNaN(utcMs)) {
    return { ok: false, reason: 'invalid Date', matchNumber: entry.MatchNumber };
  }

  const localWall = parseFifaLocalDateWallClock(entry.LocalDate);
  if (!localWall) {
    return { ok: false, reason: 'invalid LocalDate', matchNumber: entry.MatchNumber };
  }

  const fromUtc = readWallClockInTimezone(utcMs, stadiumTimezone);
  const ok = wallClockPartsEqual(fromUtc, localWall);

  return {
    ok,
    matchNumber: entry.MatchNumber,
    fromUtc,
    localWall,
    stadiumTimezone,
    dateUtc: entry.Date,
    localDateRaw: entry.LocalDate,
  };
}

export function resolveFifaEntryStadiumTimezone(entry) {
  const nameEn = extractStadiumName(entry);
  return resolveStadiumTimezone({ nameEn }) || null;
}

export async function fetchAllCalendarMatches() {
  const matches = [];
  let continuationToken = null;

  do {
    const params = {
      idSeason: env.fifaSeasonId,
      idCompetition: env.fifaCompetitionId,
      count: 200,
    };
    if (continuationToken) params.continuationToken = continuationToken;

    const data = await fifaRequest('/calendar/matches', { searchParams: params });
    matches.push(...(data?.Results ?? []));
    continuationToken = data?.ContinuationToken ?? null;
  } while (continuationToken);

  return matches;
}

export function findCalendarMatch(calendar, { matchNumber, homeFifaCode, awayFifaCode, kickoffAt }) {
  const number = Number(matchNumber);
  const homeCode = String(homeFifaCode ?? '').toUpperCase();
  const awayCode = String(awayFifaCode ?? '').toUpperCase();
  const kickoffMs = kickoffAt ? new Date(kickoffAt).getTime() : NaN;

  const candidates = calendar.filter((entry) => {
    if (Number(entry.MatchNumber) !== number) return false;

    const entryHome = extractTeamAbbreviation(entry.Home).toUpperCase();
    const entryAway = extractTeamAbbreviation(entry.Away).toUpperCase();
    if (homeCode && entryHome && entryHome !== homeCode) return false;
    if (awayCode && entryAway && entryAway !== awayCode) return false;

    if (Number.isFinite(kickoffMs) && entry.Date) {
      const entryMs = new Date(entry.Date).getTime();
      const diffHours = Math.abs(entryMs - kickoffMs) / (60 * 60 * 1000);
      if (diffHours > 30) return false;
    }

    return true;
  });

  return candidates[0] ?? null;
}

export async function fetchMatchTimeline({ idStage, idMatch }) {
  return fifaRequest(`/timelines/${env.fifaCompetitionId}/${env.fifaSeasonId}/${idStage}/${idMatch}`, {
    searchParams: { language: 'en-GB' },
  });
}

export async function fetchLiveMatchFootball({ idStage, idMatch }) {
  return fifaRequest(
    `/live/football/${env.fifaCompetitionId}/${env.fifaSeasonId}/${idStage}/${idMatch}`
  );
}

export async function resolveFifaMatchEntry(calendar, match, homeTeam, awayTeam) {
  if (match.raw?.fifaMeta?.idMatch && match.raw?.fifaMeta?.idStage) {
    const cached = calendar.find((entry) => String(entry.IdMatch) === String(match.raw.fifaMeta.idMatch));
    if (cached) return cached;

    return {
      IdMatch: match.raw.fifaMeta.idMatch,
      IdStage: match.raw.fifaMeta.idStage,
      MatchNumber: match.raw.fifaMeta.matchNumber ?? Number(match.externalId),
      Home: { IdTeam: match.raw.fifaMeta.homeTeamId },
      Away: { IdTeam: match.raw.fifaMeta.awayTeamId },
    };
  }

  return findCalendarMatch(calendar, {
    matchNumber: match.externalId,
    homeFifaCode: homeTeam?.fifaCode,
    awayFifaCode: awayTeam?.fifaCode,
    kickoffAt: match.kickoffAt,
  });
}
