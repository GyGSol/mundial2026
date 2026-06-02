import { formatLockHint, formatMatchDate } from './dateFormat.js';

/** 30 minutos antes de lockAt (cierre = 1 h antes del kickoff). */
export const REMINDER_BEFORE_LOCK_MS = 30 * 60 * 1000;

const REMINDER_EVENT_DURATION_MS = 15 * 60 * 1000;

function formatIcsUtc(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function escapeIcsText(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function foldIcsLine(line) {
  const max = 73;
  if (line.length <= max) return line;
  const parts = [];
  let rest = line;
  parts.push(rest.slice(0, max));
  rest = rest.slice(max);
  while (rest.length > 0) {
    parts.push(` ${rest.slice(0, max - 1)}`);
    rest = rest.slice(max - 1);
  }
  return parts.join('\r\n');
}

export function getTeamLabel(team, fallbackId) {
  if (team?.nameEn) return team.nameEn;
  if (team?.fifaCode) return team.fifaCode;
  return fallbackId ? `Equipo ${fallbackId}` : 'Equipo';
}

export function getMatchTitle(match) {
  const home = getTeamLabel(match.homeTeam, match.homeTeamId);
  const away = getTeamLabel(match.awayTeam, match.awayTeamId);
  return `${home} vs ${away}`;
}

export function getReminderAt(match) {
  if (match?.lockAt) {
    const lock = new Date(match.lockAt);
    if (!Number.isNaN(lock.getTime())) {
      return new Date(lock.getTime() - REMINDER_BEFORE_LOCK_MS);
    }
  }
  if (match?.kickoffAt) {
    const kickoff = new Date(match.kickoffAt);
    if (!Number.isNaN(kickoff.getTime())) {
      return new Date(kickoff.getTime() - 90 * 60 * 1000);
    }
  }
  return null;
}

export function canExportCalendarReminder(match) {
  if (!match?.predictionOpen) return false;
  const reminderAt = getReminderAt(match);
  if (!reminderAt) return false;
  return reminderAt.getTime() > Date.now();
}

export function formatReminderHint(match) {
  const reminderAt = getReminderAt(match);
  if (!reminderAt) return null;
  const when = reminderAt.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `Recordatorio en calendario: ${when} (30 min antes del cierre)`;
}

function buildReminderDescription(match) {
  const lines = [
    `Cerrá o revisá tu predicción para ${getMatchTitle(match)}.`,
    formatLockHint(match),
    match.kickoffAt ? `Partido: ${formatMatchDate(match)}` : null,
    match.group ? `Grupo ${match.group}` : null,
    'Mundial 2026 · Predicciones',
  ].filter(Boolean);
  return lines.join('\n');
}

function buildReminderEvent(match) {
  const reminderAt = getReminderAt(match);
  if (!reminderAt) return null;

  const endAt = new Date(reminderAt.getTime() + REMINDER_EVENT_DURATION_MS);
  const uid = `mundial2026-pred-${match.id}@mundial2026-predicciones`;
  const summary = escapeIcsText(`Predicción: ${getMatchTitle(match)}`);
  const description = escapeIcsText(buildReminderDescription(match));

  return [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatIcsUtc(new Date())}`,
    `DTSTART:${formatIcsUtc(reminderAt)}`,
    `DTEND:${formatIcsUtc(endAt)}`,
    foldIcsLine(`SUMMARY:${summary}`),
    foldIcsLine(`DESCRIPTION:${description}`),
    'BEGIN:VALARM',
    'TRIGGER:PT0M',
    'ACTION:DISPLAY',
    foldIcsLine(`DESCRIPTION:${summary}`),
    'END:VALARM',
    'END:VEVENT',
  ].join('\r\n');
}

export function buildRemindersIcs(matches) {
  const events = (Array.isArray(matches) ? matches : [])
    .filter(canExportCalendarReminder)
    .map(buildReminderEvent)
    .filter(Boolean);

  if (!events.length) return null;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Mundial2026//Predicciones//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');
}

function downloadIcsFile(filename, icsContent) {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadMatchReminderIcs(match) {
  const ics = buildRemindersIcs([match]);
  if (!ics) return false;
  const safeName = getMatchTitle(match)
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '');
  downloadIcsFile(`recordatorio-${safeName || match.id}.ics`, ics);
  return true;
}

export function downloadBulkRemindersIcs(matches) {
  const ics = buildRemindersIcs(matches);
  if (!ics) return 0;
  downloadIcsFile('recordatorios-predicciones-mundial2026.ics', ics);
  return (ics.match(/BEGIN:VEVENT/g) || []).length;
}
