function kickoffKey(kickoffAt) {
  if (!kickoffAt) return '';
  const ms = new Date(kickoffAt).getTime();
  return Number.isNaN(ms) ? String(kickoffAt) : String(ms);
}

function isLockedUpcoming(match) {
  return match.status === 'upcoming' && !match.predictionOpen;
}

function isUpcomingWithKickoff(match) {
  return match.status === 'upcoming' && Boolean(match.kickoffAt);
}

function sortByKickoffAsc(matches) {
  return [...matches].sort(
    (a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime()
  );
}

function matchesInFirstKickoffSlot(matches) {
  if (!matches.length) return [];
  const slot = kickoffKey(matches[0].kickoffAt);
  return matches.filter((m) => kickoffKey(m.kickoffAt) === slot);
}

/** Upcoming con predicción cerrada en el próximo horario de kickoff (puede haber varios a la vez). */
export function findNextLockedMatches(matches) {
  const locked = (matches ?? []).filter(isLockedUpcoming);
  if (!locked.length) return [];

  const slot = kickoffKey(locked[0].kickoffAt);
  return locked.filter((m) => kickoffKey(m.kickoffAt) === slot);
}

/** Próximo upcoming por kickoff (incluye predictionOpen true; puede haber varios en el mismo slot). */
export function findNextUpcomingMatches(matches) {
  const upcoming = sortByKickoffAsc((matches ?? []).filter(isUpcomingWithKickoff));
  return matchesInFirstKickoffSlot(upcoming);
}

/** @deprecated Usar findNextLockedMatches */
export function findNextLockedMatch(matches) {
  return findNextLockedMatches(matches)[0] ?? null;
}
