import { useEffect, useRef, useState } from 'react';
import { matchesApi } from '@/api/client.js';

const POLL_MS = 5_000;

export function useLiveMatchDetail(matchId, seedMatch, open) {
  const [match, setMatch] = useState(seedMatch ?? null);
  const seedRef = useRef(seedMatch);

  useEffect(() => {
    seedRef.current = seedMatch;
    if (seedMatch?.id === matchId) {
      setMatch(seedMatch);
    }
  }, [seedMatch, matchId]);

  useEffect(() => {
    if (!open || !matchId) return undefined;

    let cancelled = false;

    const refresh = async () => {
      try {
        const { match: fresh } = await matchesApi.getById(matchId);
        if (!cancelled && fresh) setMatch(fresh);
      } catch {
        if (!cancelled && seedRef.current?.id === matchId) {
          setMatch(seedRef.current);
        }
      }
    };

    void refresh();
    const timer = window.setInterval(refresh, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [open, matchId]);

  return match;
}
