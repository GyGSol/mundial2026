import { useEffect, useState } from 'react';
import { resolveLiveMatchDisplayClock } from '../lib/liveMatchClock.js';

/** Reloj en vivo que avanza con el kickoff cuando FIFA/cronología van atrasados. */
export function useLiveMatchDisplayClock(match) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (match?.status !== 'live' || !match?.kickoffAt) return undefined;
    const id = window.setInterval(() => setTick((value) => value + 1), 30_000);
    return () => window.clearInterval(id);
  }, [match?.status, match?.kickoffAt, match?.id]);

  return resolveLiveMatchDisplayClock(match);
}
