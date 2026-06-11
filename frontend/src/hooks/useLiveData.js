import { useCallback, useEffect, useRef, useState } from 'react';
import { useRealtimeRefresh } from './useWebSocket.js';

export function useLiveData(
  fetchFn,
  deps = [],
  { enabled = true, pollIntervalMs = 0, pollWhen } = {}
) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const dataRef = useRef(data);
  dataRef.current = data;

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

  useEffect(() => {
    if (!enabled || !pollIntervalMs) return undefined;

    const id = window.setInterval(() => {
      if (!pollWhen || pollWhen(dataRef.current)) {
        refresh();
      }
    }, pollIntervalMs);

    return () => window.clearInterval(id);
  }, [refresh, enabled, pollIntervalMs, pollWhen]);

  return { data, loading, error, lastUpdated, refresh };
}
