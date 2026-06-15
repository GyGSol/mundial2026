import { useCallback, useEffect, useRef, useState } from 'react';
import { useRealtimeSubscription } from '../context/RealtimeContext.jsx';

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
  const requestIdRef = useRef(0);
  const inFlightRef = useRef(0);
  dataRef.current = data;

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const requestId = ++requestIdRef.current;
    inFlightRef.current += 1;
    try {
      setError(null);
      const result = await fetchFn();
      if (requestId !== requestIdRef.current) return;
      setData(result);
      setLastUpdated(new Date());
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err.message);
    } finally {
      inFlightRef.current -= 1;
      if (inFlightRef.current === 0) {
        setLoading(false);
      }
    }
  }, [...deps, enabled]);

  useEffect(() => {
    if (!enabled) {
      setLoading(true);
      return;
    }
    refresh();
  }, [refresh, enabled]);

  useRealtimeSubscription(enabled ? refresh : null, enabled ? refresh : null);

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
