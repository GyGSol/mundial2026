export const ARGENTINA_TIMEZONE = 'America/Argentina/Buenos_Aires';

export function getBrowserTimezone() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz || ARGENTINA_TIMEZONE;
  } catch {
    return ARGENTINA_TIMEZONE;
  }
}

function formatWeekday(date, timeZone) {
  const weekday = new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    timeZone,
  }).format(date);
  return weekday.charAt(0).toUpperCase() + weekday.slice(1);
}

function formatInTimezone(date, timeZone) {
  const weekday = formatWeekday(date, timeZone);
  const dateTime = new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  }).format(date);
  return `${weekday} ${dateTime}`;
}

function tryFormatFromDate(value, timeZone) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return formatInTimezone(date, timeZone);
}

function formatTimezoneShort(timeZone) {
  if (!timeZone) return '';
  try {
    const parts = new Intl.DateTimeFormat('es-AR', {
      timeZone,
      timeZoneName: 'short',
    }).formatToParts(new Date());
    return parts.find((p) => p.type === 'timeZoneName')?.value || timeZone;
  } catch {
    return timeZone;
  }
}

export function formatPredictionUpdatedAt(value, { timeZone = ARGENTINA_TIMEZONE } = {}) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  });
}

/** `datetime-local` value (YYYY-MM-DDTHH:mm) for a UTC instant in a given IANA zone. */
export function utcInstantToDatetimeLocalValue(isoOrDate, timeZone = ARGENTINA_TIMEZONE) {
  const date = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (Number.isNaN(date.getTime())) return '';

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

/** Parse `datetime-local` wall clock in IANA zone → UTC ISO string. */
export function datetimeLocalValueToUtcInstant(value, timeZone = ARGENTINA_TIMEZONE) {
  if (!value) return null;
  const [datePart, timePart] = value.split('T');
  if (!datePart || !timePart) return null;

  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  if ([year, month, day, hour, minute].some((n) => !Number.isFinite(n))) return null;

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

  const toCalendarMinutes = (p) =>
    p.year * 525_600 + p.month * 43_200 + p.day * 1_440 + p.hour * 60 + p.minute;

  const target = { year, month, day, hour, minute };
  const targetMinutes = toCalendarMinutes(target);
  let utcMs = Date.UTC(year, month - 1, day, hour, minute);

  for (let i = 0; i < 8; i += 1) {
    const got = readInZone(utcMs);
    const deltaMinutes = targetMinutes - toCalendarMinutes(got);
    if (deltaMinutes === 0) break;
    utcMs += deltaMinutes * 60 * 1000;
  }

  const result = new Date(utcMs);
  return Number.isNaN(result.getTime()) ? null : result.toISOString();
}

export function formatMatchDate(match, { showTimezone = false, timeZone, useStadiumTimezone = false } = {}) {
  const resolvedTimeZone =
    timeZone ?? (useStadiumTimezone && match?.kickoffTimezone ? match.kickoffTimezone : ARGENTINA_TIMEZONE);
  const fromKickoff = tryFormatFromDate(match?.kickoffAt, resolvedTimeZone);
  if (fromKickoff) {
    if (!showTimezone) return fromKickoff;
    const label = formatTimezoneShort(resolvedTimeZone);
    return label ? `${fromKickoff} (${label})` : fromKickoff;
  }

  const raw = String(match?.localDate || '').trim();
  if (!raw) return '';

  const parsed = tryFormatFromDate(raw, resolvedTimeZone);
  if (parsed) return parsed;

  return raw;
}
