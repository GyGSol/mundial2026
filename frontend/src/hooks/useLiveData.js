import { useCallback, useEffect, useRef, useState } from 'react';
import { useRealtimeSubscription } from '../context/RealtimeContext.jsx';

/** @type {Map<string, { value: unknown, expiresAt: number }>} */
const memoryCacheByKey = new Map();

function readMemoryCache(key) {
  if (!key) return null;
  const entry = memoryCacheByKey.get(key);
  if (!entry || entry.expiresAt <= Date.now()) {
    if (entry) memoryCacheByKey.delete(key);
    return null;
  }
  return entry.value;
}

function writeMemoryCache(key, value, ttlMs) {
  if (!key || value === undefined) return;
  memoryCacheByKey.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

export function useLiveData(
  fetchFn,
  deps = [],
  {
    enabled = true,
    pollIntervalMs = 0,
    pollWhen,
    memoryCacheKey,
    memoryCacheTtlMs = 60_000,
    realtimeDebounceMs = 0,
  } = {}
) {
  const resolvedCacheKey = memoryCacheKey ?? (enabled ? JSON.stringify(deps) : '');
  const cachedInitial = enabled ? readMemoryCache(resolvedCacheKey) : null;

  const [data, setData] = useState(cachedInitial);
  const [loading, setLoading] = useState(enabled && !cachedInitial);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(cachedInitial ? new Date() : null);
  const dataRef = useRef(data);
  const requestIdRef = useRef(0);
  const inFlightRef = useRef(false);
  const pendingRefreshRef = useRef(false);
  const debounceTimerRef = useRef(null);
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
      writeMemoryCache(resolvedCacheKey, result, memoryCacheTtlMs);
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
  }, [...deps, enabled, fetchFn, resolvedCacheKey, memoryCacheTtlMs]);

  const scheduleRealtimeRefresh = useCallback(() => {
    if (!enabled) return;
    if (!realtimeDebounceMs) {
      refresh();
      return;
    }
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      refresh();
    }, realtimeDebounceMs);
  }, [enabled, realtimeDebounceMs, refresh]);

  useEffect(() => {
    if (!enabled) {
      pendingRefreshRef.current = false;
      setLoading(true);
      return undefined;
    }

    requestIdRef.current += 1;
    pendingRefreshRef.current = false;
    inFlightRef.current = false;

    const cached = readMemoryCache(resolvedCacheKey);
    if (cached) {
      setData(cached);
      setLoading(false);
    } else {
      setData(null);
      setLoading(true);
    }

    refresh();

    return () => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [refresh, enabled, resolvedCacheKey, memoryCacheTtlMs]);

  useRealtimeSubscription(
    enabled ? scheduleRealtimeRefresh : null,
    enabled ? scheduleRealtimeRefresh : null
  );

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

/** Test helper */
export function clearUseLiveDataMemoryCache() {
  memoryCacheByKey.clear();
}
