const MATCH_CLEARLY_IN_PROGRESS_MAX_MINUTE = 85;

function isKnockoutExternalId(externalId) {
  const id = Number(externalId);
  return Number.isFinite(id) && id >= 73 && id <= 104;
}

function knockoutTieBlocksFinishClient(match) {
  if (!isKnockoutExternalId(match?.externalId)) return false;
  const home = Number(match?.homeScore) || 0;
  const away = Number(match?.awayScore) || 0;
  if (home !== away) return false;
  if (match?.penaltyShootout?.winnerSide) return false;

  const raw = match?.raw ?? {};
  const finishedFlag = raw.finished ?? raw.Finished;
  if (finishedFlag === 'TRUE' || finishedFlag === true || finishedFlag === 'true') return true;
  if (elapsedTokenIndicatesFinished(readElapsedToken(match))) return true;

  const timelineKey = maxTimelineSortKey(match);
  if (timelineKey > 90) return true;

  return false;
}

function readElapsedToken(match) {
  const raw = match?.raw ?? match ?? {};
  return String(raw.time_elapsed ?? raw.timeElapsed ?? match?.timeElapsed ?? '')
    .trim()
    .toLowerCase();
}

export function elapsedTokenIndicatesFinished(elapsed) {
  const normalized = String(elapsed ?? '')
    .trim()
    .toLowerCase();
  return (
    normalized === 'finished' ||
    normalized === 'ft' ||
    normalized === 'fulltime' ||
    normalized === 'final'
  );
}

function getTimeline(match) {
  return match?.matchTimeline ?? match?.raw?.fifaEvents?.timeline ?? [];
}

export function matchTimelineHasMatchEnd(match) {
  const timeline = getTimeline(match);
  return Array.isArray(timeline) && timeline.some((event) => event?.type === 'match_end');
}

function maxTimelineSortKey(match) {
  const timeline = getTimeline(match);
  if (!Array.isArray(timeline) || !timeline.length) return Number.NEGATIVE_INFINITY;

  let bestKey = Number.NEGATIVE_INFINITY;
  for (const event of timeline) {
    if (event.minute == null || !Number.isFinite(Number(event.minute))) continue;
    const key =
      event.sortKey != null
        ? Number(event.sortKey)
        : Number(event.minute) + (Number(event.extraMinute) > 0 ? Number(event.extraMinute) / 100 : 0);
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

  const minute = Number(normalized.replace(/'+$/, ''));
  if (Number.isFinite(minute) && minute > 0 && minute < MATCH_CLEARLY_IN_PROGRESS_MAX_MINUTE) {
    return true;
  }

  return false;
}

export function matchEvidenceShowsInProgress(match) {
  if (matchTimelineHasMatchEnd(match)) return false;

  const timelineKey = maxTimelineSortKey(match);
  if (timelineKey >= 0 && timelineKey < MATCH_CLEARLY_IN_PROGRESS_MAX_MINUTE) {
    return true;
  }

  return elapsedNumericMinuteIndicatesEarlyPlay(readElapsedToken(match));
}

function resolveKickoffMs(match) {
  const liveStarted = match?.liveStartedPushSentAt
    ? new Date(match.liveStartedPushSentAt).getTime()
    : NaN;
  if (Number.isFinite(liveStarted)) return liveStarted;

  const delayedKickoff = match?.weatherOps?.delayedKickoffAt
    ? new Date(match.weatherOps.delayedKickoffAt).getTime()
    : NaN;
  if (Number.isFinite(delayedKickoff)) return delayedKickoff;

  const kickoff = match?.kickoffAt ?? match?.scheduleKickoffAt;
  const kickoffMs = kickoff ? new Date(kickoff).getTime() : NaN;
  return Number.isFinite(kickoffMs) ? kickoffMs : null;
}

function minWallClockMsForTimelineMinute(timelineMinute) {
  if (!Number.isFinite(timelineMinute) || timelineMinute <= 0) {
    return 90 * 60 * 1000;
  }
  const halftimeMs = timelineMinute > 45 ? 15 * 60 * 1000 : 0;
  return timelineMinute * 60 * 1000 + halftimeMs;
}

export function wallClockAllowsMatchFinished(match, now = Date.now()) {
  const kickoffMs = resolveKickoffMs(match);
  if (kickoffMs == null || kickoffMs > now) return false;

  const elapsedMs = now - kickoffMs;
  const timelineKey = maxTimelineSortKey(match);
  const timelineMinute = timelineKey > Number.NEGATIVE_INFINITY ? timelineKey : null;

  if (timelineMinute != null && timelineMinute > 0) {
    return elapsedMs >= minWallClockMsForTimelineMinute(timelineMinute) * 0.9;
  }

  if (matchTimelineHasMatchEnd(match) || elapsedTokenIndicatesFinished(readElapsedToken(match))) {
    return elapsedMs >= 90 * 60 * 1000;
  }

  return elapsedMs >= 85 * 60 * 1000;
}

export function matchHasCreibleFinishEvidence(match, now = Date.now()) {
  if (match?.status !== 'finished') return false;
  if (knockoutTieBlocksFinishClient(match)) return false;
  if (matchEvidenceShowsInProgress(match)) return false;
  if (matchTimelineHasMatchEnd(match)) return wallClockAllowsMatchFinished(match, now);
  return elapsedTokenIndicatesFinished(readElapsedToken(match)) && wallClockAllowsMatchFinished(match, now);
}

/** Mantener el visor abierto: live, falso final, o suspendido. */
export function shouldKeepLiveViewerOpen(match, now = Date.now()) {
  if (!match) return false;
  if (knockoutTieBlocksFinishClient(match)) return true;
  if (match.status === 'live') {
    if (matchEvidenceShowsInProgress(match)) return true;
    if (elapsedTokenIndicatesFinished(readElapsedToken(match)) || matchTimelineHasMatchEnd(match)) {
      return !wallClockAllowsMatchFinished(match, now);
    }
    return true;
  }
  if (match.status === 'finished') {
    return !matchHasCreibleFinishEvidence(match, now);
  }
  return false;
}

export function isLiveCardFinalizing(match) {
  if (match?.status !== 'live') return false;
  if (knockoutTieBlocksFinishClient(match)) return false;
  const elapsed = readElapsedToken(match);
  return elapsedTokenIndicatesFinished(elapsed) || matchTimelineHasMatchEnd(match);
}

import { getEffectiveMatchPlayState, isMatchPlayPaused } from './matchPlayState.js';

export function liveCardBadgeLabel(match, { displayClock } = {}) {
  const knockoutStillPlaying = knockoutTieBlocksFinishClient(match);
  if (match?.status === 'finished' && !knockoutStillPlaying) return 'Final';
  if (isLiveCardFinalizing(match)) return 'Finalizando…';
  if (match?.status === 'live' || knockoutStillPlaying) {
    const playState = getEffectiveMatchPlayState(match);
    if (isMatchPlayPaused(playState)) {
      const clock =
        playState.phase === 'halftime'
          ? null
          : playState.frozenClock && playState.frozenClock !== playState.label
            ? playState.frozenClock
            : displayClock ?? match?.timeElapsed;
      const label = playState.label ?? 'En pausa';
      return clock && playState.phase !== 'halftime' && playState.phase !== 'extra_time'
        ? `${label} · ${clock}`
        : label;
    }
    const clock = displayClock ?? match?.timeElapsed;
    return clock ? `En vivo · ${clock}` : 'En vivo';
  }
  return 'Final';
}
