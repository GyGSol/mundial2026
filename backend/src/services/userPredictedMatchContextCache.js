import { buildUserPredictedMatchContext } from './predictedMatchContextService.js';

const CACHE_TTL_MS = 30_000;
/** @type {Map<string, { expiresAt: number, value?: object, promise?: Promise<object> }>} */
const cacheByUserId = new Map();

export function invalidateUserPredictedMatchContext(userId) {
  if (!userId) return;
  cacheByUserId.delete(String(userId));
}

export async function getCachedUserPredictedMatchContext(userId) {
  const key = String(userId);
  const now = Date.now();
  const entry = cacheByUserId.get(key);

  if (entry?.value && entry.expiresAt > now) {
    return entry.value;
  }

  if (entry?.promise) {
    return entry.promise;
  }

  const promise = buildUserPredictedMatchContext(userId).then((value) => {
    cacheByUserId.set(key, {
      value,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return value;
  });

  cacheByUserId.set(key, {
    expiresAt: now + CACHE_TTL_MS,
    promise,
  });

  return promise;
}

/** Test helper */
export function clearUserPredictedMatchContextCache() {
  cacheByUserId.clear();
}
