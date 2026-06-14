import { isPredictionLocked } from './predictionLockService.js';

/** Partido en vivo o previo con predicciones ya cerradas (calentamiento). */
export function isStreamWatchEligible(match) {
  if (!match) return false;
  if (match.status === 'live') return true;
  if (match.status === 'upcoming' && isPredictionLocked(match)) return true;
  return false;
}

export function canWatchConfiguredStream(match, { liveStreamEnabled, configured }) {
  if (!liveStreamEnabled || !configured) return false;
  return isStreamWatchEligible(match);
}
