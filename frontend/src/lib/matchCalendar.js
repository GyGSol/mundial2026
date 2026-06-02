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

/** Solo nombre del equipo (sin URLs de banderas ni emojis en calendario). */
function teamName(team) {
  if (!team) return 'Por definir';
  return team.nameEn || team.fifaCode || 'Equipo';
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

function matchTitle(match) {
  return `${teamName(match.homeTeam)} vs ${teamName(match.awayTeam)}`;
}

function groupLabel(match) {
  if (!match.group) return '';
  return match.matchday ? `Grupo ${match.group} · Fecha ${match.matchday}` : `Grupo ${match.group}`;
}

function predictionActionLine(match) {
  const hasPrediction = match.prediction != null;
  const { homeGoals, awayGoals } = match.prediction ?? {};

  if (hasPrediction && match.predictionOpen) {
    return `Editá tu predicción (${homeGoals}-${awayGoals}) antes del cierre.`;
  }
  if (hasPrediction) {
    return `Predicción cargada: ${homeGoals}-${awayGoals}.`;
  }
  if (match.predictionOpen) {
    return 'Cargá tu predicción antes del cierre.';
  }
  return 'Predicción cerrada para este partido.';
}

function buildDescription(match, predictionsUrl) {
  const kickoff = formatMatchDate(match);
  const lock = formatLockAt(match.lockAt);
  const group = groupLabel(match);

  const lines = [
    group ? `Partido: ${matchTitle(match)} (${group})` : `Partido: ${matchTitle(match)}`,
    kickoff ? `Inicio del partido: ${kickoff}` : null,
    lock ? `Cierre de predicciones: ${lock}` : 'Cierre de predicciones: 1 h antes del partido',
    predictionActionLine(match),
    predictionsUrl,
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
  const summary = escapeIcsText(`Mundial 2026 · ${matchTitle(match)}`);
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
    'DESCRIPTION:Recordá tu predicción del Mundial',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');
}

function isIosDevice() {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/** Opens ICS in the same user gesture (avoids navigator.share Permission denied). */
export function scheduleMatchInCalendar(match) {
  const ics = buildMatchIcs(match);
  const blob = new Blob([ics], { type: 'text/calendar' });
  const filename = `mundial-partido-${match.externalId || match.id}.ics`;
  const blobUrl = URL.createObjectURL(blob);

  try {
    if (isIosDevice()) {
      window.location.assign(blobUrl);
    } else {
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 120_000);
  }
}
