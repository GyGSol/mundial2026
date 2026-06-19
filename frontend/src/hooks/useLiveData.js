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
    getPollIntervalMs,
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
  const refreshWaitersRef = useRef([]);
  const debounceTimerRef = useRef(null);
  dataRef.current = data;

  const resolveRefreshWaiters = useCallback(() => {
    const waiters = refreshWaitersRef.current.splice(0);
    for (const resolve of waiters) {
      resolve();
    }
  }, []);

  const refresh = useCallback(() => {
    if (!enabled) return Promise.resolve();

    return new Promise((resolve) => {
      if (inFlightRef.current) {
        refreshWaitersRef.current.push(resolve);
        pendingRefreshRef.current = true;
        return;
      }

      const run = async () => {
        inFlightRef.current = true;
        try {
          do {
            pendingRefreshRef.current = false;
            const requestId = ++requestIdRef.current;
            setError(null);
            try {
              const result = await fetchFn();
              if (requestId !== requestIdRef.current) continue;
              if (result === undefined) continue;
              setData(result);
              setLastUpdated(new Date());
              writeMemoryCache(resolvedCacheKey, result, memoryCacheTtlMs);
            } catch (err) {
              if (requestId === requestIdRef.current) {
                setError(err.message);
              }
            }
          } while (pendingRefreshRef.current);
        } finally {
          inFlightRef.current = false;
          setLoading(false);
          resolve();
          resolveRefreshWaiters();
        }
      };

      void run();
    });
  }, [...deps, enabled, fetchFn, resolvedCacheKey, memoryCacheTtlMs, resolveRefreshWaiters]);

  const patchData = useCallback(
    (updater) => {
      setData((prev) => {
        if (prev == null) return prev;
        const next = typeof updater === 'function' ? updater(prev) : updater;
        if (next != null) {
          writeMemoryCache(resolvedCacheKey, next, memoryCacheTtlMs);
          dataRef.current = next;
        }
        return next;
      });
      setLastUpdated(new Date());
    },
    [resolvedCacheKey, memoryCacheTtlMs]
  );

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
      refreshWaitersRef.current = [];
      setLoading(true);
      return undefined;
    }

    requestIdRef.current += 1;
    pendingRefreshRef.current = false;
    refreshWaitersRef.current = [];
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
    if (!enabled || (!pollIntervalMs && !getPollIntervalMs)) return undefined;

    let timeoutId;

    const schedule = () => {
      const interval =
        typeof getPollIntervalMs === 'function'
          ? getPollIntervalMs(dataRef.current)
          : pollIntervalMs;
      if (!interval) return;

      timeoutId = window.setTimeout(() => {
        if (!pollWhen || pollWhen(dataRef.current)) {
          refresh();
        }
        schedule();
      }, interval);
    };

    schedule();

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [refresh, enabled, pollIntervalMs, getPollIntervalMs, pollWhen]);

  return { data, loading, error, lastUpdated, refresh, patchData };
}

/** Test helper */
export function clearUseLiveDataMemoryCache() {
  memoryCacheByKey.clear();
}
