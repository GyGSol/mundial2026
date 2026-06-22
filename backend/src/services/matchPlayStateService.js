import { normalizeWeatherOps } from './matchWeatherOpsRules.js';
import {
  clockSortKeyFromParts,
  formatTimeElapsed,
  latestClockFromTimeline,
  latestMinuteFromScorerLists,
  parseElapsedClockToSortKey,
  parseScorersField,
  resolveLiveTimeElapsed,
} from './matchLiveData.js';

const STRUCTURAL_TIMELINE_TYPES = new Set([
  'period_start',
  'period_end',
  'hydration_break',
  'match_end',
]);

const IN_PLAY_PLAY_STATE = {
  phase: 'in_play',
  reason: null,
  label: null,
  frozenClock: null,
  since: null,
  source: null,
};

export function fifaTokenIndicatesSuspended(token) {
  const normalized = String(token ?? '')
    .trim()
    .toLowerCase();
  if (!normalized) return false;
  return (
    normalized.includes('suspend') ||
    normalized.includes('interrupt') ||
    normalized === 'int' ||
    normalized.includes('abandon')
  );
}

export function fifaTokenIndicatesHalftime(token) {
  const normalized = String(token ?? '')
    .trim()
    .toLowerCase();
  if (!normalized) return false;
  return (
    normalized === 'ht' ||
    normalized === 'halftime' ||
    normalized.includes('half_time') ||
    normalized.includes('halftime') ||
    normalized.includes('half time') ||
    normalized.includes('half-time')
  );
}

export function fifaTokenIndicatesDelayed(token) {
  const normalized = String(token ?? '')
    .trim()
    .toLowerCase();
  if (!normalized) return false;
  return normalized.includes('delay') || normalized.includes('postpon');
}

/** @param {Record<string, unknown> | null | undefined} liveMatch @param {Record<string, unknown> | null | undefined} fifaEntry */
export function extractFifaLiveState(liveMatch, fifaEntry = null) {
  const period =
    liveMatch?.Period ??
    liveMatch?.MatchPeriod ??
    fifaEntry?.Period ??
    null;
  const matchStatus =
    liveMatch?.MatchStatus ??
    liveMatch?.Status ??
    fifaEntry?.MatchStatus ??
    null;
  const matchTime =
    liveMatch?.MatchTime ??
    liveMatch?.TimeElapsed ??
    liveMatch?.Minute ??
    fifaEntry?.MatchTime ??
    null;

  return {
    period: period != null ? String(period) : null,
    matchStatus: matchStatus != null ? String(matchStatus) : null,
    matchTime: matchTime != null ? String(matchTime) : null,
    syncedAt: new Date().toISOString(),
  };
}

function timelineEventSortKey(event) {
  if (event?.sortKey != null && Number.isFinite(Number(event.sortKey))) {
    return Number(event.sortKey);
  }
  return clockSortKeyFromParts(event?.minute, event?.extraMinute);
}

/** @param {Array<Record<string, unknown>>} timeline */
export function latestStructuralTimelineEvent(timeline = []) {
  let best = null;
  let bestKey = Number.NEGATIVE_INFINITY;

  for (const event of timeline) {
    if (!STRUCTURAL_TIMELINE_TYPES.has(event?.type)) continue;
    const key = timelineEventSortKey(event);
    if (key >= bestKey) {
      bestKey = key;
      best = event;
    }
  }

  return best;
}

/** @param {Array<Record<string, unknown>>} timeline */
function maxPlaySortKey(timeline = []) {
  let bestKey = Number.NEGATIVE_INFINITY;

  for (const event of timeline) {
    if (STRUCTURAL_TIMELINE_TYPES.has(event?.type)) continue;
    const key = timelineEventSortKey(event);
    if (key > bestKey) bestKey = key;
  }

  return bestKey;
}

/** @param {Array<Record<string, unknown>>} timeline */
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

/** @param {Array<Record<string, unknown>>} timeline */
export function timelineIndicatesActiveHydrationBreak(timeline = []) {
  const latest = latestStructuralTimelineEvent(timeline);
  return latest?.type === 'hydration_break';
}

function pickMaxClockLabel(...labels) {
  let bestKey = Number.NEGATIVE_INFINITY;
  let bestLabel = null;

  for (const label of labels.flat()) {
    if (!label) continue;
    const key = parseElapsedClockToSortKey(label);
    if (key > bestKey) {
      bestKey = key;
      bestLabel = label;
    }
  }

  return bestLabel;
}

function computeFrozenClock(match, timeline, raw) {
  return (
    pickMaxClockLabel(
      formatTimeElapsed(raw),
      resolveLiveTimeElapsed(raw, timeline),
      latestClockFromTimeline(timeline),
      latestMinuteFromScorerLists(
        parseScorersField(raw.home_scorers ?? raw.homeScorers),
        parseScorersField(raw.away_scorers ?? raw.awayScorers)
      )
    ) ?? null
  );
}

function buildPlayState({
  phase,
  reason = null,
  label,
  source,
  since = null,
  frozenClock = null,
  match,
  timeline,
  raw,
}) {
  return {
    phase,
    reason,
    label,
    source,
    since: since ?? null,
    frozenClock: frozenClock ?? computeFrozenClock(match, timeline, raw),
  };
}

/** @param {Record<string, unknown>} match @param {{ timeline?: Array<Record<string, unknown>>, raw?: Record<string, unknown> }} [options] */
export function resolveMatchPlayState(match, options = {}) {
  if (match?.status !== 'live') {
    return { ...IN_PLAY_PLAY_STATE };
  }

  const timeline = options.timeline ?? match?.matchTimeline ?? match?.raw?.fifaEvents?.timeline ?? [];
  const raw = options.raw ?? match?.raw ?? {};
  const weatherOps = normalizeWeatherOps(match?.weatherOps);
  const fifaLive = raw?.fifaLiveState ?? {};

  const periodToken = String(fifaLive.period ?? fifaLive.Period ?? '').trim();
  const statusToken = String(fifaLive.matchStatus ?? fifaLive.MatchStatus ?? '').trim();

  if (weatherOps.phase === 'postponed') {
    return buildPlayState({
      phase: 'delayed',
      reason: 'weather',
      label: 'Postergado',
      source: 'weather_ops',
      since: weatherOps.since?.toISOString?.() ?? weatherOps.since ?? null,
      match,
      timeline,
      raw,
    });
  }

  if (weatherOps.phase === 'pre_kickoff_delay') {
    return buildPlayState({
      phase: 'delayed',
      reason: 'weather',
      label: 'Demorado pre-kickoff',
      source: 'weather_ops',
      since: weatherOps.since?.toISOString?.() ?? weatherOps.since ?? null,
      match,
      timeline,
      raw,
    });
  }

  if (weatherOps.phase === 'suspended') {
    return buildPlayState({
      phase: 'suspended',
      reason: 'weather',
      label: 'Suspendido por clima',
      source: 'weather_ops',
      since: weatherOps.since?.toISOString?.() ?? weatherOps.since ?? null,
      match,
      timeline,
      raw,
    });
  }

  if (fifaTokenIndicatesSuspended(periodToken) || fifaTokenIndicatesSuspended(statusToken)) {
    return buildPlayState({
      phase: 'suspended',
      reason: 'official',
      label: 'Suspendido',
      source: 'fifa_live',
      since: fifaLive.syncedAt ?? null,
      match,
      timeline,
      raw,
    });
  }

  if (fifaTokenIndicatesDelayed(periodToken) || fifaTokenIndicatesDelayed(statusToken)) {
    return buildPlayState({
      phase: 'delayed',
      reason: 'official',
      label: 'Demorado',
      source: 'fifa_live',
      since: fifaLive.syncedAt ?? null,
      match,
      timeline,
      raw,
    });
  }

  if (fifaTokenIndicatesHalftime(periodToken) || fifaTokenIndicatesHalftime(statusToken)) {
    return buildPlayState({
      phase: 'halftime',
      reason: null,
      label: 'Entretiempo',
      source: 'fifa_live',
      since: fifaLive.syncedAt ?? null,
      frozenClock: 'Entretiempo',
      match,
      timeline,
      raw,
    });
  }

  if (timelineIndicatesHalftime(timeline)) {
    return buildPlayState({
      phase: 'halftime',
      reason: null,
      label: 'Entretiempo',
      source: 'fifa_timeline',
      frozenClock: 'Entretiempo',
      match,
      timeline,
      raw,
    });
  }

  if (timelineIndicatesActiveHydrationBreak(timeline)) {
    return buildPlayState({
      phase: 'break',
      reason: 'hydration',
      label: 'Pausa hidratación',
      source: 'fifa_timeline',
      match,
      timeline,
      raw,
    });
  }

  return { ...IN_PLAY_PLAY_STATE };
}

export function serializeMatchPlayStateForClient(playState) {
  if (!playState || playState.phase === 'in_play') {
    return { phase: 'in_play', reason: null, label: null, frozenClock: null, since: null, source: null };
  }

  return {
    phase: playState.phase,
    reason: playState.reason ?? null,
    label: playState.label ?? null,
    frozenClock: playState.frozenClock ?? null,
    since:
      playState.since instanceof Date
        ? playState.since.toISOString()
        : playState.since ?? null,
    source: playState.source ?? null,
  };
}

export function isMatchPlayPaused(playState) {
  return Boolean(playState && playState.phase && playState.phase !== 'in_play');
}

export function resolvePausedDisplayClock(playState) {
  if (!isMatchPlayPaused(playState)) return null;
  if (playState.phase === 'halftime') return 'Entretiempo';
  if (playState.label && playState.phase === 'suspended') {
    return playState.frozenClock ?? null;
  }
  return playState.frozenClock ?? playState.label ?? null;
}
