import { ARGENTINA_TIMEZONE, formatMatchDate } from '@/lib/dateFormat.js';

const ALARM_MS = 90 * 60 * 1000;
const EVENT_DURATION_MS = 2 * 60 * 60 * 1000;

function escapeIcsText(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function toIcsUtc(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function teamLabel(team) {
  if (!team) return 'Por definir';
  const name = team.nameEn || team.fifaCode || 'Equipo';
  return team.flag ? `${team.flag} ${name}` : name;
}

function formatLockAt(lockAt) {
  if (!lockAt) return null;
  const date = new Date(lockAt);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: ARGENTINA_TIMEZONE,
  }).format(date);
}

function buildDescription(match, predictionsUrl) {
  const home = teamLabel(match.homeTeam);
  const away = teamLabel(match.awayTeam);
  const kickoff = formatMatchDate(match);
  const lock = formatLockAt(match.lockAt);
  const tv =
    match.broadcasters?.map((b) => b.name).filter(Boolean).join(', ') || null;
  const prediction =
    match.prediction != null
      ? `Tu predicción: ${match.prediction.homeGoals} - ${match.prediction.awayGoals}`
      : 'Todavía no cargaste predicción';

  const lines = [
    'Mundial FIFA 2026 — Mundial2026 Predicciones',
    '',
    `${home} vs ${away}`,
    `Grupo ${match.group || '—'}${match.matchday ? ` · Fecha ${match.matchday}` : ''}`,
    kickoff ? `Inicio (Argentina): ${kickoff}` : null,
    lock ? `Cierre de predicciones: ${lock}` : 'Las predicciones cierran 1 hora antes del partido',
    match.stadium?.nameEn
      ? `Estadio: ${match.stadium.nameEn}${match.stadium.city ? ` (${match.stadium.city})` : ''}`
      : null,
    tv ? `TV (Argentina): ${tv}` : null,
    '',
    prediction,
    '',
    `Cargá o editá tu predicción: ${predictionsUrl}`,
    '',
    'Recordatorio: 1 hora y 30 minutos antes del pitazo inicial.',
  ];

  return lines.filter(Boolean).join('\n');
}

export function getMatchAlarmAt(kickoffAt) {
  const kickoff = new Date(kickoffAt);
  if (Number.isNaN(kickoff.getTime())) return null;
  return new Date(kickoff.getTime() - ALARM_MS);
}

export function canScheduleMatchReminder(match) {
  if (match.status !== 'upcoming' || !match.kickoffAt) return false;
  const alarmAt = getMatchAlarmAt(match.kickoffAt);
  return alarmAt && alarmAt.getTime() > Date.now();
}

export function buildMatchIcs(match, { predictionsUrl } = {}) {
  const kickoff = new Date(match.kickoffAt);
  if (Number.isNaN(kickoff.getTime())) {
    throw new Error('Este partido no tiene horario de inicio');
  }

  const end = new Date(kickoff.getTime() + EVENT_DURATION_MS);
  const home = teamLabel(match.homeTeam);
  const away = teamLabel(match.awayTeam);
  const summary = escapeIcsText(`Mundial 2026: ${home} vs ${away}`);
  const location = escapeIcsText(
    [match.stadium?.nameEn, match.stadium?.city, match.stadium?.country].filter(Boolean).join(', ')
  );
  const url =
    predictionsUrl ||
    (typeof window !== 'undefined' ? `${window.location.origin}/predictions` : '/predictions');
  const description = escapeIcsText(buildDescription(match, url));
  const uid = `mundial2026-match-${match.externalId || match.id}@mundial2026-pred`;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Mundial2026 Predicciones//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toIcsUtc(new Date())}`,
    `DTSTART:${toIcsUtc(kickoff)}`,
    `DTEND:${toIcsUtc(end)}`,
    `SUMMARY:${summary}`,
    location ? `LOCATION:${location}` : null,
    `DESCRIPTION:${description}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT1H30M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Recordá cargar tu predicción del Mundial',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');
}

export async function scheduleMatchInCalendar(match) {
  const ics = buildMatchIcs(match);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const filename = `mundial-partido-${match.externalId || match.id}.ics`;
  const file = new File([blob], filename, { type: 'text/calendar' });

  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      files: [file],
      title: 'Agendar partido — Mundial 2026',
    });
    return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
