function formatInUserTimezone(date) {
  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: userTimeZone,
  }).format(date);
}

function tryFormatFromDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return formatInUserTimezone(date);
}

function parseMdyDateAsUtc(raw) {
  const mdy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (!mdy) return null;

  const [, mm, dd, yyyy, hh = '00', min = '00'] = mdy;
  const utcDate = new Date(
    Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min))
  );
  if (Number.isNaN(utcDate.getTime())) return null;
  return utcDate;
}

export function formatMatchDate(match) {
  // kickoffAt is canonical and converts reliably to player's timezone.
  const fromKickoff = tryFormatFromDate(match?.kickoffAt);
  if (fromKickoff) return fromKickoff;

  const raw = String(match?.localDate || '').trim();
  if (!raw) return '';

  // Fallback for API strings like MM/DD/YYYY HH:mm (assumed UTC source).
  const parsedMdy = parseMdyDateAsUtc(raw);
  if (parsedMdy) return formatInUserTimezone(parsedMdy);

  // Last fallback for parseable strings.
  const parsed = tryFormatFromDate(raw);
  if (parsed) return parsed;

  return raw;
}
