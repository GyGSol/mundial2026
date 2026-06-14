/** Partido en vivo o previo con predicciones cerradas (calentamiento). */
export function canShowMatchStream(match) {
  if (!match) return false;
  if (match.status === 'live') return true;
  if (match.status === 'upcoming' && match.predictionOpen === false) return true;
  return false;
}

export function isMatchStreamWarmup(match) {
  return match?.status === 'upcoming' && match?.predictionOpen === false;
}
