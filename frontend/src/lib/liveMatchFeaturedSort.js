import { getEffectiveMatchPlayState, isMatchPlayPaused } from './matchPlayState.js';

function kickoffMs(match) {
  if (!match?.kickoffAt) return 0;
  const ms = new Date(match.kickoffAt).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

/** 0 = jugando, 1 = pausado/suspendido, 2 = resto. */
export function liveMatchFeaturedSortTier(match) {
  if (match?.status !== 'live') return 2;

  const weatherPhase = match?.weatherOps?.phase ?? 'normal';
  if (weatherPhase === 'suspended' || weatherPhase === 'pre_kickoff_delay' || weatherPhase === 'postponed') {
    return 1;
  }

  const playState = getEffectiveMatchPlayState(match);
  if (isMatchPlayPaused(playState)) return 1;

  return 0;
}

export function compareLiveMatchesForFeaturedBar(a, b) {
  const tierA = liveMatchFeaturedSortTier(a);
  const tierB = liveMatchFeaturedSortTier(b);
  if (tierA !== tierB) return tierA - tierB;

  const kickA = kickoffMs(a);
  const kickB = kickoffMs(b);
  if (tierA === 0) {
    if (kickA !== kickB) return kickB - kickA;
  } else if (kickA !== kickB) {
    return kickA - kickB;
  }

  return String(a?.id ?? '').localeCompare(String(b?.id ?? ''));
}

export function sortLiveMatchesForFeaturedBar(matches = []) {
  return [...matches].sort(compareLiveMatchesForFeaturedBar);
}
