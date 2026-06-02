import { useCallback, useState } from 'react';
import {
  getScheduledMatchIds,
  markMatchScheduled,
  markMatchesScheduled,
  unmarkMatchScheduled,
} from '@/lib/scheduledMatchesStorage.js';

export function useScheduledMatches() {
  const [scheduledIds, setScheduledIds] = useState(() => getScheduledMatchIds());

  const refresh = useCallback(() => {
    setScheduledIds(getScheduledMatchIds());
  }, []);

  const isScheduled = useCallback((matchId) => scheduledIds.has(matchId), [scheduledIds]);

  const markScheduled = useCallback(
    (matchId) => {
      markMatchScheduled(matchId);
      refresh();
    },
    [refresh]
  );

  const markManyScheduled = useCallback(
    (matchIds) => {
      markMatchesScheduled(matchIds);
      refresh();
    },
    [refresh]
  );

  const unmarkScheduled = useCallback(
    (matchId) => {
      unmarkMatchScheduled(matchId);
      refresh();
    },
    [refresh]
  );

  return { isScheduled, markScheduled, markManyScheduled, unmarkScheduled };
}
