export const ARGENTINA_TIMEZONE = 'America/Argentina/Buenos_Aires';

function formatInTimezone(date, timeZone) {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  }).format(date);
}

function tryFormatFromDate(value, timeZone = ARGENTINA_TIMEZONE) {
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

export function formatMatchDate(match, { showTimezone = false } = {}) {
  const timeZone = match?.displayTimezone || ARGENTINA_TIMEZONE;
  const fromKickoff = tryFormatFromDate(match?.kickoffAt, timeZone);
  if (fromKickoff) {
    if (!showTimezone) return fromKickoff;
    const label = formatTimezoneShort(timeZone);
    return label ? `${fromKickoff} (${label})` : fromKickoff;
  }

  const raw = String(match?.localDate || '').trim();
  if (!raw) return '';

  const parsed = tryFormatFromDate(raw, timeZone);
  if (parsed) return parsed;

  return raw;
}

export function formatLockHint(match) {
  if (!match?.lockAt) return null;
  const timeZone = match?.displayTimezone || ARGENTINA_TIMEZONE;
  const lockText = tryFormatFromDate(match.lockAt, timeZone);
  if (!lockText) return null;
  return `Cierre de predicciones: ${lockText}`;
}
