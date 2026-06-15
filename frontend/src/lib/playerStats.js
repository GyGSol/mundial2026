export function hasPlayerStats(stats) {
  if (!stats || stats.fuente === 'sin_datos') return false;
  const total = stats.acumuladoTemporada ?? {};
  return (total.PJ ?? 0) > 0 || (stats.ultimosPartidos?.length ?? 0) > 0;
}

export function totalSeasonGoals(stats) {
  if (!stats) return 0;
  return (stats.club?.goles ?? 0) + (stats.seleccion?.goles ?? 0);
}

export function formatStatValue(value, fallback = '—') {
  if (value == null || value === '') return fallback;
  return value;
}

export function formatKm(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `${Number(value).toFixed(1)} km`;
}
