import { compareMatchesBySchedule } from '../services/matchSortService.js';
import { resolveScheduleKickoffAt } from '../services/kickoffTimeService.js';

export function kickoffSlotKey(match) {
  const kickoff = resolveScheduleKickoffAt(match);
  if (!kickoff) return '';
  const ms = kickoff.getTime();
  return Number.isNaN(ms) ? String(kickoff) : String(ms);
}

export function matchesInFirstKickoffSlot(matches = []) {
  const sorted = [...matches].sort(compareMatchesBySchedule);
  if (!sorted.length) return [];
  const slot = kickoffSlotKey(sorted[0]);
  return sorted.filter((match) => kickoffSlotKey(match) === slot);
}

export function groupMatchesByKickoffSlot(matches = []) {
  const sorted = [...matches].sort(compareMatchesBySchedule);
  const batches = [];
  for (const match of sorted) {
    const slot = kickoffSlotKey(match);
    const last = batches[batches.length - 1];
    if (last && last.slot === slot) {
      last.matches.push(match);
    } else {
      batches.push({ slot, matches: [match] });
    }
  }
  return batches;
}
