/** Clases Tailwind para la grilla de partidos destacados (en vivo + recién finalizados). */
export function matchBarGridClass(count) {
  if (count <= 1) return 'grid-cols-1';
  if (count === 2) return 'grid-cols-1 sm:grid-cols-2';
  return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
}

/** Partidos en curso: siempre apilados (nunca en la misma fila). */
export function liveMatchesBarGridClass() {
  return 'grid-cols-1';
}
