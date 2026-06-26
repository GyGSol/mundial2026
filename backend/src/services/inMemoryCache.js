/**
 * Generic in-memory cache with TTL, in-flight deduplication, and optional LRU cap.
 */
export function createInMemoryCache({ defaultTtlMs = 30_000, maxEntries = 0 } = {}) {
  /** @type {Map<string, { expiresAt: number, value?: unknown, promise?: Promise<unknown> }>} */
  const cacheByKey = new Map();

  function trimToMaxEntries() {
    if (!maxEntries || maxEntries <= 0) return;
    while (cacheByKey.size > maxEntries) {
      const oldestKey = cacheByKey.keys().next().value;
      if (oldestKey === undefined) break;
      cacheByKey.delete(oldestKey);
    }
  }

  function getValidEntry(key, now = Date.now()) {
    const entry = cacheByKey.get(key);
    if (entry?.value !== undefined && entry.expiresAt > now) {
      return entry;
    }
    if (entry?.expiresAt !== undefined && entry.expiresAt <= now) {
      cacheByKey.delete(key);
    }
    return null;
  }

  function storeResolvedValue(key, value, ttlMs) {
    const resolvedTtl = typeof ttlMs === 'function' ? ttlMs(value) : ttlMs;
    cacheByKey.delete(key);
    cacheByKey.set(key, {
      value,
      expiresAt: Date.now() + resolvedTtl,
    });
    trimToMaxEntries();
  }

  return {
    async getOrCompute(key, compute, ttlMs = defaultTtlMs) {
      const now = Date.now();
      const valid = getValidEntry(key, now);
      if (valid) return valid.value;

      const entry = cacheByKey.get(key);
      if (entry?.promise) {
        return entry.promise;
      }

      const promise = Promise.resolve()
        .then(compute)
        .then((value) => {
          storeResolvedValue(key, value, ttlMs);
          return value;
        })
        .catch((err) => {
          cacheByKey.delete(key);
          throw err;
        });

      cacheByKey.set(key, {
        expiresAt: now + (typeof ttlMs === 'function' ? defaultTtlMs : ttlMs),
        promise,
      });
      trimToMaxEntries();

      return promise;
    },

    invalidate(key) {
      if (key === undefined) {
        cacheByKey.clear();
        return;
      }
      cacheByKey.delete(key);
    },

    invalidatePrefix(prefix) {
      for (const key of cacheByKey.keys()) {
        if (key.startsWith(prefix)) {
          cacheByKey.delete(key);
        }
      }
    },

    clear() {
      cacheByKey.clear();
    },
  };
}
