import { useCallback, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'mundial2026:expandedLiveMatchId';

function readStoredExpandedId() {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeStoredExpandedId(matchId) {
  try {
    if (matchId) sessionStorage.setItem(STORAGE_KEY, matchId);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore quota / private mode
  }
}

/**
 * Partido en vivo expandido en la barra (acordeón). Con varios live, solo uno tiene cronología/cancha.
 */
export function useFeaturedLiveExpansion(liveMatches = []) {
  const primaryId = liveMatches[0]?.id ?? null;

  const [expandedId, setExpandedId] = useState(() => readStoredExpandedId());

  const resolvedId = useMemo(() => {
    if (expandedId && liveMatches.some((match) => match.id === expandedId)) {
      return expandedId;
    }
    return primaryId;
  }, [expandedId, liveMatches, primaryId]);

  useEffect(() => {
    if (resolvedId && resolvedId !== expandedId) {
      setExpandedId(resolvedId);
    }
  }, [resolvedId, expandedId]);

  const setExpandedLiveMatchId = useCallback((matchId) => {
    setExpandedId(matchId);
    writeStoredExpandedId(matchId);
  }, []);

  return [resolvedId, setExpandedLiveMatchId];
}
