import { parsedTimelineHasMatchEnd } from './fifaTimelineParser.js';
import { parseElapsedClockToSortKey } from './matchLiveData.js';

/** Tiempo máximo desde kickoff para cerrar un partido que quedó en `live` (90' + descanso + margen). */
export const MATCH_STALE_AFTER_KICKOFF_MS = 120 * 60 * 1000;

/** Minuto en timeline por debajo del cual un partido sigue claramente en curso. */
export const MATCH_CLEARLY_IN_PROGRESS_MAX_MINUTE = 85;

export function matchFifaTimelineIndicatesFinished(match) {
  const timeline = match?.raw?.fifaEvents?.timeline;
  if (!Array.isArray(timeline) || !timeline.length) return false;
  return parsedTimelineHasMatchEnd(timeline);
}

export function isMatchKickoffStale(kickoffAt, now = Date.now()) {
  const kickoffMs = kickoffAt ? new Date(kickoffAt).getTime() : NaN;
  if (!Number.isFinite(kickoffMs)) return false;
  return now - kickoffMs >= MATCH_STALE_AFTER_KICKOFF_MS;
}

export function readElapsedToken(matchOrGame) {
  const raw = matchOrGame?.raw ?? matchOrGame ?? {};
  return String(raw.time_elapsed ?? raw.timeElapsed ?? '').toLowerCase();
}

/** Alineado con formatTimeElapsed: tokens que indican pitido final. */
export function elapsedTokenIndicatesFinished(elapsed) {
  const normalized = String(elapsed ?? '').trim().toLowerCase();
  return (
    normalized === 'finished' ||
    normalized === 'ft' ||
    normalized === 'fulltime' ||
    normalized === 'final'
  );
}

export function matchEvidentlyStarted(matchOrGame) {
  const normalized = readElapsedToken(matchOrGame);
  if (!normalized || normalized === 'notstarted' || normalized === '0') return false;
  return true;
}

export function fifaEntryIndicatesFinished(fifaEntry) {
  if (!fifaEntry) return false;
  const period = String(fifaEntry.Period ?? fifaEntry.MatchStatus ?? '').toLowerCase();
  if (!period) return false;
  return (
    period.includes('full') ||
    period.includes('ended') ||
    period.includes('finished') ||
    period.includes('afterpenalt') ||
    period.includes('afterextra')
  );
}

function maxTimelineSortKey(match) {
  const timeline = match?.raw?.fifaEvents?.timeline ?? match?.matchTimeline;
  if (!Array.isArray(timeline) || !timeline.length) return Number.NEGATIVE_INFINITY;

  let bestKey = Number.NEGATIVE_INFINITY;
  for (const event of timeline) {
    if (event.minute == null || !Number.isFinite(Number(event.minute))) continue;
    const key =
      event.sortKey != null
        ? Number(event.sortKey)
        : parseElapsedClockToSortKey(
            event.extraMinute != null && Number(event.extraMinute) > 0
              ? `${event.minute}+${event.extraMinute}'`
              : `${event.minute}'`
          );
    if (key > bestKey) bestKey = key;
  }
  return bestKey;
}

function elapsedNumericMinuteIndicatesEarlyPlay(elapsed) {
  const normalized = String(elapsed ?? '').trim().toLowerCase();
  if (normalized === 'ht' || normalized === 'halftime') return true;

  const extraMatch = normalized.match(/^(\d+)\+(\d+)$/);
  if (extraMatch) {
    const base = Number(extraMatch[1]);
    return Number.isFinite(base) && base > 0 && base < MATCH_CLEARLY_IN_PROGRESS_MAX_MINUTE;
  }

  const minute = Number(normalized);
  if (Number.isFinite(minute) && minute > 0 && minute < MATCH_CLEARLY_IN_PROGRESS_MAX_MINUTE) {
    return true;
  }

  return false;
}

/**
 * Evidencia de que el partido sigue en juego (timeline/minuto), ignorando tokens erróneos de fin.
 * Usado para bloquear cierre prematuro y reabrir `finished` incorrectos.
 */
export function matchEvidenceShowsInProgress(match) {
  if (matchFifaTimelineIndicatesFinished(match)) return false;

  const timelineKey = maxTimelineSortKey(match);
  if (timelineKey >= 0 && timelineKey < MATCH_CLEARLY_IN_PROGRESS_MAX_MINUTE) {
    return true;
  }

  return elapsedNumericMinuteIndicatesEarlyPlay(readElapsedToken(match));
}

/** Partido `live` con evidencia clara de que aún no terminó (p. ej. API envió `final` al min 4). */
export function isMatchClearlyInProgress(match) {
  if (match?.status !== 'live') return false;
  return matchEvidenceShowsInProgress(match);
}

/** Cierra partidos `live` cuando la API quedó en live/finished=FALSE tras el pitido final. */
export function shouldFinalizeStaleLiveMatch(match, now = Date.now()) {
  if (match?.status !== 'live') return false;

  if (isMatchClearlyInProgress(match)) return false;

  const raw = match.raw ?? {};
  const finished = raw.finished ?? raw.Finished;
  const elapsed = readElapsedToken(match);

  if (
    finished === 'TRUE' ||
    finished === true ||
    finished === 'true' ||
    elapsedTokenIndicatesFinished(elapsed)
  ) {
    return true;
  }

  if (matchFifaTimelineIndicatesFinished(match)) {
    return true;
  }

  if (!isMatchKickoffStale(match.kickoffAt, now)) return false;

  return matchEvidentlyStarted(match);
}
