import {
  ARGENTINA_TIMEZONE,
  OFFICIAL_KICKOFFS_AR,
} from '../data/officialFixtureArgentina.js';
import { resolveStadiumTimezone } from './stadiumTimezones.js';

const MDY_TIME_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/;

export function parseLocalDateParts(localDate) {
  const raw = String(localDate || '').trim();
  const m = raw.match(MDY_TIME_RE);
  if (!m) return null;

  return {
    month: Number(m[1]),
    day: Number(m[2]),
    year: Number(m[3]),
    hour: Number(m[4] ?? 0),
    minute: Number(m[5] ?? 0),
  };
}

/**
 * Converts wall-clock time in an IANA zone (e.g. 13:00 in Mexico City) to a UTC Date.
 */
export function localWallClockToUtc(localDate, timeZone) {
  const parts = parseLocalDateParts(localDate);
  if (!parts || !timeZone) return null;

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });

  const readInZone = (utcMs) => {
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
      hour: chunk.hour === 24 ? 0 : chunk.hour,
      minute: chunk.minute,
    };
  };

  const target = parts;
  let utcMs = Date.UTC(target.year, target.month - 1, target.day, target.hour, target.minute);

  const toCalendarMinutes = (p) =>
    p.year * 525_600 + p.month * 43_200 + p.day * 1_440 + p.hour * 60 + p.minute;

  const targetMinutes = toCalendarMinutes(target);

  for (let i = 0; i < 8; i += 1) {
    const got = readInZone(utcMs);
    const deltaMinutes = targetMinutes - toCalendarMinutes(got);
    if (deltaMinutes === 0) break;
    utcMs += deltaMinutes * 60 * 1000;
  }

  const result = new Date(utcMs);
  return Number.isNaN(result.getTime()) ? null : result;
}

function parseIsoDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function argentinaIsoToMdy(isoLocal) {
  const [datePart, timePart] = isoLocal.split('T');
  const [year, month, day] = datePart.split('-');
  const [hour, minute] = timePart.split(':');
  return `${month}/${day}/${year} ${hour}:${minute}`;
}

/** Horario oficial FIFA en hora Argentina → UTC. */
export function resolveOfficialKickoffAt(externalId) {
  const isoLocal = OFFICIAL_KICKOFFS_AR[String(externalId)];
  if (!isoLocal) return null;
  return localWallClockToUtc(argentinaIsoToMdy(isoLocal), ARGENTINA_TIMEZONE);
}

/**
 * Canonical kickoff for sync: official Argentina fixture, else stadium local_date, else API fields.
 */
export function resolveKickoffAt(game, { stadiumTimezone } = {}) {
  const externalId = String(game.id ?? game._id ?? game.idGame ?? '');
  const official = resolveOfficialKickoffAt(externalId);
  if (official) return official;

  const localDate = game.local_date ?? game.localDate ?? '';
  const tz =
    stadiumTimezone ||
    resolveStadiumTimezone({
      city: game.stadium_city ?? game.stadiumCity,
      country: game.stadium_country ?? game.stadiumCountry,
      nameEn: game.stadium_name ?? game.stadiumName,
    });

  if (localDate && tz) {
    const fromLocal = localWallClockToUtc(localDate, tz);
    if (fromLocal) return fromLocal;
  }

  const utcFromApi = parseIsoDate(game.utc_date ?? game.utcDate);
  if (utcFromApi) return utcFromApi;

  const kickoffFromApi = parseIsoDate(game.kickoff_at ?? game.kickoffAt);
  if (kickoffFromApi) return kickoffFromApi;

  if (localDate) {
    const parsed = new Date(localDate);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return new Date('2026-06-11T00:00:00Z');
}

export function resolveKickoffForStoredMatch(match, stadium) {
  if (match.externalId?.startsWith('sim-')) {
    return match.kickoffAt ?? null;
  }

  const official = resolveOfficialKickoffAt(match.externalId);
  if (official) return official;

  const stadiumTimezone = stadium?.timezone || resolveStadiumTimezone(stadium || {});
  if (!match.localDate || !stadiumTimezone) {
    return match.kickoffAt ?? null;
  }

  return localWallClockToUtc(match.localDate, stadiumTimezone) ?? match.kickoffAt ?? null;
}
