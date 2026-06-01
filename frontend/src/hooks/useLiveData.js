import { useCallback, useEffect, useState } from 'react';
import { useRealtimeRefresh } from './useWebSocket.js';

export function useLiveData(fetchFn, deps = [], { enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      setError(null);
      const result = await fetchFn();
      setData(result);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [...deps, enabled]);

  useEffect(() => {
    if (!enabled) {
      setLoading(true);
      return;
    }
    refresh();
  }, [refresh, enabled]);

  useRealtimeRefresh(refresh);

  return { data, loading, error, lastUpdated, refresh };
}
