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

export function formatMatchDate(match, { showTimezone = false, timeZone } = {}) {
  const resolvedTimeZone = timeZone ?? ARGENTINA_TIMEZONE;
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
