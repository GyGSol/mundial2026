function kickoffKey(kickoffAt) {
  if (!kickoffAt) return '';
  const ms = new Date(kickoffAt).getTime();
  return Number.isNaN(ms) ? String(kickoffAt) : String(ms);
}

function isLockedUpcoming(match) {
  return match.status === 'upcoming' && !match.predictionOpen;
}

/** Upcoming con predicción cerrada en el próximo horario de kickoff (puede haber varios a la vez). */
export function findNextLockedMatches(matches) {
  const locked = (matches ?? []).filter(isLockedUpcoming);
  if (!locked.length) return [];

  const slot = kickoffKey(locked[0].kickoffAt);
  return locked.filter((m) => kickoffKey(m.kickoffAt) === slot);
}

/** @deprecated Usar findNextLockedMatches */
export function findNextLockedMatch(matches) {
  return findNextLockedMatches(matches)[0] ?? null;
}
