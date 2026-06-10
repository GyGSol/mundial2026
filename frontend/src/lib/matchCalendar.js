import { formatMatchDate, getBrowserTimezone } from '@/lib/dateFormat.js';

const LOCK_MS = 60 * 60 * 1000;
const REMINDER_BEFORE_LOCK_MS = 30 * 60 * 1000;

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
    timeZone: getBrowserTimezone(),
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
  const hasPrediction = Boolean(match.hasPrediction ?? match.prediction?.userSubmitted);
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

export function predictionsUrlForMatch(match) {
  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://mundial2026-pred.herokuapp.com';
  const matchId = match?.id;
  if (!matchId) return `${origin}/predictions`;
  return `${origin}/predictions?match=${encodeURIComponent(matchId)}`;
}

export function isFirstGroupEncounter(match) {
  if (!match?.group || match.isKnockout) return false;
  const type = String(match.type || 'group').toLowerCase();
  if (type !== 'group') return false;
  return Number(match.matchday) === 1;
}

export function shouldIncludeGroupStandings(match) {
  if (!match?.group || match.isKnockout) return false;
  const type = String(match.type || 'group').toLowerCase();
  if (type !== 'group') return false;
  return !isFirstGroupEncounter(match);
}

function teamCode(row) {
  return row.fifaCode || (row.nameEn || row.teamId || '—').slice(0, 3).toUpperCase();
}

export function formatGroupStandingsForCalendar(group) {
  if (!group?.standings?.length) return null;

  const lines = [
    '',
    `⚽ Tabla del Grupo ${group.group} (con tus predicciones):`,
    '#  Equipo  PJ  PG  GF  DG  Pts',
  ];

  for (const row of group.standings) {
    const dg = row.goalDiff > 0 ? `+${row.goalDiff}` : String(row.goalDiff);
    lines.push(
      `${String(row.rank).padStart(1)}  ${teamCode(row).padEnd(6)} ${String(row.played).padStart(2)}  ${String(row.won).padStart(2)}  ${String(row.goalsFor).padStart(2)}  ${dg.padStart(3)}  ${String(row.points).padStart(2)}`
    );
  }

  return lines.join('\n');
}

function buildDescription(match, predictionsUrl, groupStandings) {
  const kickoff = formatMatchDate(match);
  const lock = formatLockAt(match.lockAt);
  const group = groupLabel(match);

  const lines = [
    group ? `Partido: ${matchTitle(match)} (${group})` : `Partido: ${matchTitle(match)}`,
    kickoff ? `Inicio del partido: ${kickoff}` : null,
    lock ? `Cierre de predicciones: ${lock}` : 'Cierre de predicciones: 1 h antes del partido',
    predictionActionLine(match),
    shouldIncludeGroupStandings(match)
      ? formatGroupStandingsForCalendar(groupStandings)
      : null,
    predictionsUrl,
  ];

  return lines.filter(Boolean).join('\n');
}

function getLockAtFromKickoff(kickoffAt) {
  const kickoff = new Date(kickoffAt);
  if (Number.isNaN(kickoff.getTime())) return null;
  return new Date(kickoff.getTime() - LOCK_MS);
}

function getLockAtFromMatch(match) {
  if (match.lockAt) {
    const lock = new Date(match.lockAt);
    if (!Number.isNaN(lock.getTime())) return lock;
  }
  return getLockAtFromKickoff(match.kickoffAt);
}

/** Inicio del evento de agenda: 30 min antes del cierre de predicciones. */
export function getMatchEventStartAt(match) {
  const lockAt = getLockAtFromMatch(match);
  if (!lockAt) return null;
  return new Date(lockAt.getTime() - REMINDER_BEFORE_LOCK_MS);
}

/** @deprecated Usar getMatchEventStartAt; se mantiene por compatibilidad. */
export function getMatchAlarmAt(kickoffAt) {
  const lockAt = getLockAtFromKickoff(kickoffAt);
  if (!lockAt) return null;
  return new Date(lockAt.getTime() - REMINDER_BEFORE_LOCK_MS);
}

export function canScheduleMatchReminder(match) {
  if (match.status !== 'upcoming' || !match.kickoffAt) return false;
  const eventStart = getMatchEventStartAt(match);
  return eventStart && eventStart.getTime() > Date.now();
}

function buildVeventLines(match, { predictionsUrl, groupStandings } = {}) {
  const eventStart = getMatchEventStartAt(match);
  if (!eventStart) {
    throw new Error('Este partido no tiene horario de inicio');
  }

  const lockAt = getLockAtFromMatch(match);
  const end = lockAt ?? new Date(eventStart.getTime() + REMINDER_BEFORE_LOCK_MS);
  const summary = escapeIcsText(`⚽ Mundial 2026 · ${matchTitle(match)}`);
  const location = escapeIcsText(
    [match.stadium?.nameEn, match.stadium?.city, match.stadium?.country].filter(Boolean).join(', ')
  );
  const url = predictionsUrl || predictionsUrlForMatch(match);
  const description = escapeIcsText(buildDescription(match, url, groupStandings));
  const uid = `mundial2026-match-${match.externalId || match.id}@mundial2026-pred`;

  return [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toIcsUtc(new Date())}`,
    `DTSTART:${toIcsUtc(eventStart)}`,
    `DTEND:${toIcsUtc(end)}`,
    `SUMMARY:${summary}`,
    location ? `LOCATION:${location}` : null,
    `DESCRIPTION:${description}`,
    'BEGIN:VALARM',
    'TRIGGER:PT0S',
    'ACTION:DISPLAY',
    'DESCRIPTION:Recordá tu predicción del Mundial',
    'END:VALARM',
    'END:VEVENT',
  ].filter(Boolean);
}

function wrapIcsCalendar(eventBlocks) {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Mundial2026 Predicciones//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...eventBlocks,
    'END:VCALENDAR',
  ].join('\r\n');
}

export function buildMatchIcs(match, options = {}) {
  return wrapIcsCalendar(buildVeventLines(match, options));
}

export function buildAllMatchesIcs(matches = [], standingsByGroup = {}) {
  const schedulable = matches.filter(canScheduleMatchReminder);
  if (!schedulable.length) {
    throw new Error('No hay partidos próximos para agendar');
  }
  const events = schedulable.flatMap((match) =>
    buildVeventLines(match, {
      groupStandings: standingsByGroup[String(match.group || '').toUpperCase()],
    })
  );
  return wrapIcsCalendar(events);
}

export function getSchedulableMatches(matches = []) {
  return matches.filter(canScheduleMatchReminder);
}

function isIosDevice() {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function openIcsBlob(ics, filename) {
  const blob = new Blob([ics], { type: 'text/calendar' });
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

/** Opens ICS in the same user gesture (avoids navigator.share Permission denied). */
export function scheduleMatchInCalendar(match, options = {}) {
  const ics = buildMatchIcs(match, options);
  openIcsBlob(ics, `mundial-partido-${match.externalId || match.id}.ics`);
}

export function scheduleAllMatchesInCalendar(matches, standingsByGroup = {}) {
  const ics = buildAllMatchesIcs(matches, standingsByGroup);
  openIcsBlob(ics, 'mundial-partidos.ics');
}

export async function fetchGroupStandingsForMatch(match) {
  if (!shouldIncludeGroupStandings(match)) return undefined;
  try {
    const { predictionsApi } = await import('../api/client.js');
    const data = await predictionsApi.groupStandings({ group: match.group });
    return data.groups?.[0];
  } catch {
    return undefined;
  }
}

export async function fetchStandingsByGroupForCalendar() {
  const { predictionsApi } = await import('../api/client.js');
  const data = await predictionsApi.groupStandings();
  return Object.fromEntries((data.groups ?? []).map((group) => [group.group, group]));
}
