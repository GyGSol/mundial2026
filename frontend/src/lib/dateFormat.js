function tryFormatFromDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatMatchDate(match) {
  const fromKickoff = tryFormatFromDate(match?.kickoffAt);
  if (fromKickoff) return fromKickoff;

  const raw = String(match?.localDate || '').trim();
  if (!raw) return '';

  // Normalize common API shape "MM/DD/YYYY HH:mm" to "DD/MM/YYYY HH:mm".
  const mdy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}:\d{2}))?$/);
  if (mdy) {
    const [, mm, dd, yyyy, hhmm] = mdy;
    const day = dd.padStart(2, '0');
    const month = mm.padStart(2, '0');
    return `${day}/${month}/${yyyy}${hhmm ? ` ${hhmm}` : ''}`;
  }

  return raw;
}
