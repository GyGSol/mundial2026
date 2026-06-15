import { sortMatchesBySchedule } from './matchSort.js';

function kickoffKey(kickoffAt) {
  if (!kickoffAt) return '';
  const ms = new Date(kickoffAt).getTime();
  return Number.isNaN(ms) ? String(kickoffAt) : String(ms);
}

function matchKickoffForSlot(match) {
  return match.scheduleKickoffAt ?? match.kickoffAt;
}

function isLockedUpcoming(match) {
  return match.status === 'upcoming' && !match.predictionOpen;
}

function isUpcomingWithKickoff(match) {
  return match.status === 'upcoming' && Boolean(matchKickoffForSlot(match));
}

function matchesInFirstKickoffSlot(matches) {
  if (!matches.length) return [];
  const slot = kickoffKey(matchKickoffForSlot(matches[0]));
  return matches.filter((m) => kickoffKey(matchKickoffForSlot(m)) === slot);
}

/** Upcoming con predicción cerrada en el próximo horario de kickoff (puede haber varios a la vez). */
export function findNextLockedMatches(matches) {
  const locked = sortMatchesBySchedule((matches ?? []).filter(isLockedUpcoming));
  if (!locked.length) return [];

  const slot = kickoffKey(matchKickoffForSlot(locked[0]));
  return locked.filter((m) => kickoffKey(matchKickoffForSlot(m)) === slot);
}

/** Próximo upcoming por kickoff (incluye predictionOpen true; puede hay varios en el mismo slot). */
export function findNextUpcomingMatches(matches) {
  const upcoming = sortMatchesBySchedule((matches ?? []).filter(isUpcomingWithKickoff));
  return matchesInFirstKickoffSlot(upcoming);
}

/** @deprecated Usar findNextLockedMatches */
export function findNextLockedMatch(matches) {
  return findNextLockedMatches(matches)[0] ?? null;
}
