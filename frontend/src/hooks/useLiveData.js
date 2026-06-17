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
  const inFlightRef = useRef(false);
  const pendingRefreshRef = useRef(false);
  dataRef.current = data;

  const refresh = useCallback(async () => {
    if (!enabled) return;
    if (inFlightRef.current) {
      pendingRefreshRef.current = true;
      return;
    }
    inFlightRef.current = true;
    const requestId = ++requestIdRef.current;
    try {
      setError(null);
      const result = await fetchFn();
      if (requestId !== requestIdRef.current) return;
      if (result === undefined) return;
      setData(result);
      setLastUpdated(new Date());
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err.message);
    } finally {
      inFlightRef.current = false;
      setLoading(false);
      if (pendingRefreshRef.current) {
        pendingRefreshRef.current = false;
        refresh();
      }
    }
  }, [...deps, enabled]);

  useEffect(() => {
    if (!enabled) {
      pendingRefreshRef.current = false;
      setLoading(true);
      return;
    }
    requestIdRef.current += 1;
    pendingRefreshRef.current = false;
    inFlightRef.current = false;
    setLoading(true);
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
