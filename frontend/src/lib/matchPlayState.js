const STRUCTURAL_TIMELINE_TYPES = new Set([
  'period_start',
  'period_end',
  'hydration_break',
  'match_end',
]);

export function isMatchPlayPaused(playState) {
  return Boolean(playState?.phase && playState.phase !== 'in_play');
}

export function getEffectiveMatchPlayState(match) {
  if (match?.matchPlayState?.phase && match.matchPlayState.phase !== 'in_play') {
    const playState = match.matchPlayState;
    if (!playState.frozenClock && match?.timeElapsed) {
      return { ...playState, frozenClock: match.timeElapsed };
    }
    return playState;
  }

  if (match?.status !== 'live') {
    return match?.matchPlayState ?? { phase: 'in_play' };
  }

  const weatherPhase = match?.weatherOps?.phase ?? 'normal';
  if (weatherPhase === 'suspended') {
    return {
      phase: 'suspended',
      reason: 'weather',
      label: 'Suspendido por clima',
      frozenClock: match?.timeElapsed ?? null,
      source: 'weather_ops',
    };
  }
  if (weatherPhase === 'pre_kickoff_delay') {
    return {
      phase: 'delayed',
      reason: 'weather',
      label: 'Demorado pre-kickoff',
      frozenClock: match?.timeElapsed ?? null,
      source: 'weather_ops',
    };
  }
  if (weatherPhase === 'postponed') {
    return {
      phase: 'delayed',
      reason: 'weather',
      label: 'Postergado',
      frozenClock: null,
      source: 'weather_ops',
    };
  }

  const timeline = match?.matchTimeline ?? [];
  if (timelineIndicatesHalftime(timeline)) {
    return {
      phase: 'halftime',
      reason: null,
      label: 'Entretiempo',
      frozenClock: 'Entretiempo',
      source: 'fifa_timeline',
    };
  }

  return match?.matchPlayState ?? { phase: 'in_play' };
}

function timelineEventSortKey(event) {
  if (event?.sortKey != null && Number.isFinite(Number(event.sortKey))) {
    return Number(event.sortKey);
  }
  const minute = Number(event?.minute);
  const extra = Number(event?.extraMinute ?? 0);
  if (!Number.isFinite(minute)) return Number.NEGATIVE_INFINITY;
  return extra > 0 ? minute + extra / 100 : minute;
}

function maxPlaySortKey(timeline = []) {
  let bestKey = Number.NEGATIVE_INFINITY;

  for (const event of timeline) {
    if (STRUCTURAL_TIMELINE_TYPES.has(event?.type)) continue;
    const key = timelineEventSortKey(event);
    if (key > bestKey) bestKey = key;
  }

  return bestKey;
}

export function timelineIndicatesHalftime(timeline = []) {
  let firstHalfEnded = false;
  let secondHalfStarted = false;

  for (const event of timeline) {
    if (event?.type === 'period_end') {
      if (event.phase === 'first' || (event.minute != null && Number(event.minute) <= 45)) {
        firstHalfEnded = true;
      }
      if (event.phase === 'second' || (event.minute != null && Number(event.minute) > 45)) {
        return false;
      }
    }
    if (event?.type === 'period_start') {
      if (event.phase === 'second' || (event.minute != null && Number(event.minute) >= 45)) {
        secondHalfStarted = true;
      }
    }
  }

  if (!firstHalfEnded || secondHalfStarted) return false;
  if (maxPlaySortKey(timeline) > 45.5) return false;
  return true;
}

export function resolvePausedDisplayClock(playState) {
  if (!isMatchPlayPaused(playState)) return null;
  if (playState.phase === 'halftime') return 'Entretiempo';
  return playState.frozenClock ?? null;
}

export function resolveLiveMatchesColumnTitle(matches = []) {
  if (!matches.length) return 'Partido en curso';

  const states = matches.map((match) => getEffectiveMatchPlayState(match));
  const allPaused = states.every((state) => isMatchPlayPaused(state));
  const suspendedCount = states.filter((state) => state.phase === 'suspended').length;

  if (allPaused && suspendedCount > 0) {
    return matches.length > 1 ? 'Partidos suspendidos' : 'Partido suspendido';
  }
  if (allPaused) {
    return matches.length > 1 ? 'Partidos en pausa' : 'Partido en pausa';
  }
  return matches.length > 1 ? 'Partidos en curso' : 'Partido en curso';
}

export function getMatchPlayStateBadgeText(playState) {
  if (!isMatchPlayPaused(playState)) return null;
  return playState.label ?? null;
}
