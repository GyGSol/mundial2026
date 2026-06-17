import { parsedTimelineHasMatchEnd } from './fifaTimelineParser.js';

/** Tiempo máximo desde kickoff para cerrar un partido que quedó en `live` (90' + descanso + margen). */
export const MATCH_STALE_AFTER_KICKOFF_MS = 120 * 60 * 1000;

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

/** Cierra partidos `live` cuando la API quedó en live/finished=FALSE tras el pitido final. */
export function shouldFinalizeStaleLiveMatch(match, now = Date.now()) {
  if (match?.status !== 'live') return false;

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
