/** Primer upcoming con predicción cerrada (ordenado por kickoffAt en el API). */
export function findNextLockedMatch(matches) {
  return (matches ?? []).find((m) => m.status === 'upcoming' && !m.predictionOpen) ?? null;
}
