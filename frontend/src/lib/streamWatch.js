/** Partido en vivo o previo con predicciones cerradas y señal disponible. */
export function canShowMatchStream(match) {
  if (!match) return false;
  if (match.stream != null) return Boolean(match.stream.canWatch);
  if (match.status === 'live') return true;
  return match.status === 'upcoming' && match.predictionOpen === false;
}

export function isMatchStreamWarmup(match) {
  return match?.status === 'upcoming' && match?.predictionOpen === false;
}
