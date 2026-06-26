import { createInMemoryCache } from './inMemoryCache.js';
import { enrichFeaturedBarPayload } from './liveFeaturedBarService.js';
import { attachStreamMetaToMatches } from './streamMetaService.js';
import { featuredBarInputsSignature } from './matchEnrichmentRevision.js';

const LIVE_TTL_MS = 10_000;

const cache = createInMemoryCache({ defaultTtlMs: LIVE_TTL_MS, maxEntries: 48 });

function featuredBarCacheKey(userId, inputsSignature, detailMatchId) {
  const userKey = userId ? String(userId) : 'anon';
  const detailKey = detailMatchId ? String(detailMatchId) : 'auto';
  return `bar:${userKey}:${inputsSignature}:${detailKey}`;
}

async function finalizeFeaturedBar(featured) {
  const [liveMatches, recentFinishedMatches] = await Promise.all([
    attachStreamMetaToMatches(featured.liveMatches),
    attachStreamMetaToMatches(featured.recentFinishedMatches),
  ]);
  return { liveMatches, recentFinishedMatches, detailMatchId: featured.detailMatchId };
}

export async function getCachedFeaturedBarPayload({
  activeLiveRaw,
  recentFeaturedRaw,
  userId,
  detailMatchId,
}) {
  const inputsSignature = featuredBarInputsSignature(activeLiveRaw, recentFeaturedRaw);
  const key = featuredBarCacheKey(userId, inputsSignature, detailMatchId);

  return cache.getOrCompute(
    key,
    async () => {
      const featured = await enrichFeaturedBarPayload({
        activeLiveRaw,
        recentFeaturedRaw,
        userId,
        detailMatchId,
      });
      return finalizeFeaturedBar(featured);
    },
    LIVE_TTL_MS
  );
}

export function invalidateLiveFeaturedBarCache() {
  cache.clear();
}

/** Test helper */
export function clearLiveFeaturedBarCache() {
  cache.clear();
}
