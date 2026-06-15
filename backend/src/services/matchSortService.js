import { resolveScheduleKickoffAt } from './kickoffTimeService.js';

export function matchScheduleSortKey(match) {
  if (!match) {
    return { kickoff: 0, externalId: '', id: '' };
  }
  const kickoff = resolveScheduleKickoffAt(match);
  return {
    kickoff: kickoff ? kickoff.getTime() : 0,
    externalId: match.externalId ?? '',
    id: match._id?.toString?.() ?? match.id ?? '',
  };
}

/** Tournament fixture order by FIFA match number (admin selects use #N). */
export function compareMatchesByFifaNumber(matchA, matchB) {
  const extA = String(matchA?.externalId ?? '');
  const extB = String(matchB?.externalId ?? '');
  const aIsNum = /^\d+$/.test(extA);
  const bIsNum = /^\d+$/.test(extB);
  if (aIsNum && bIsNum) return Number(extA) - Number(extB);
  if (aIsNum !== bIsNum) return aIsNum ? -1 : 1;
  return extA.localeCompare(extB, undefined, { numeric: true });
}

/** Stable tournament order: schedule kickoff → externalId → id. */
export function compareMatchesBySchedule(matchA, matchB) {
  const a = matchScheduleSortKey(matchA);
  const b = matchScheduleSortKey(matchB);
  if (a.kickoff !== b.kickoff) return a.kickoff - b.kickoff;
  if (a.externalId !== b.externalId) {
    return a.externalId.localeCompare(b.externalId, undefined, { numeric: true });
  }
  return a.id.localeCompare(b.id);
}

export function sortMatchesBySchedule(matches = []) {
  return [...matches].sort(compareMatchesBySchedule);
}
