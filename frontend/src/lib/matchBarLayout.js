/** Clases Tailwind para la grilla de partidos destacados (en vivo + recién finalizados). */
export function matchBarGridClass() {
  return 'grid-cols-1';
}

/** Partidos en curso y recién finalizados: siempre apilados (nunca en la misma fila). */
export function liveMatchesBarGridClass() {
  return matchBarGridClass();
}
