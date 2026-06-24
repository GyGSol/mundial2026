/**
 * Generic in-memory cache with TTL and in-flight request deduplication.
 */
export function createInMemoryCache({ defaultTtlMs = 30_000 } = {}) {
  /** @type {Map<string, { expiresAt: number, value?: unknown, promise?: Promise<unknown> }>} */
  const cacheByKey = new Map();

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
          const resolvedTtl =
            typeof ttlMs === 'function' ? ttlMs(value) : ttlMs;
          cacheByKey.set(key, {
            value,
            expiresAt: Date.now() + resolvedTtl,
          });
          return value;
        })
        .catch((err) => {
          cacheByKey.delete(key);
          throw err;
        });

      cacheByKey.set(key, {
        expiresAt: now + ttlMs,
        promise,
      });

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
