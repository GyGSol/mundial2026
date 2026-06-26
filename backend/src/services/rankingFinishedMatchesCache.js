import { Match } from '../models/Match.js';
import {
  enrichMatchesForRankingArchive,
  prepareFifaShirtMapsForMatches,
} from './matchEnrichmentService.js';
import { buildMatchLineupPayload } from './matchLineupService.js';
import { attachStreamMetaToMatches } from './streamMetaService.js';
import { createInMemoryCache, CACHE_TTL_UNTIL_INVALIDATE } from './inMemoryCache.js';

/** Partidos finalizados en el archivo colapsable del ranking (más recientes primero). */
export const FINISHED_ARCHIVE_LIMIT = 25;

/** Partidos finalizados: estables hasta que termina otro partido (invalidación explícita). */
export const FINISHED_ARCHIVE_CACHE_TTL_MS = CACHE_TTL_UNTIL_INVALIDATE;

const CACHE_KEY = 'finished-archive';

const cache = createInMemoryCache({ defaultTtlMs: FINISHED_ARCHIVE_CACHE_TTL_MS });

async function loadFinishedArchiveMatches() {
  const finishedArchiveRaw = await Match.find({
    status: 'finished',
    kickoffAt: { $lte: new Date() },
  })
    .sort({ kickoffAt: -1, externalId: -1 })
    .limit(FINISHED_ARCHIVE_LIMIT)
    .lean();

  await prepareFifaShirtMapsForMatches(finishedArchiveRaw);
  const enriched = await enrichMatchesForRankingArchive(finishedArchiveRaw, null);
  const rawById = new Map(finishedArchiveRaw.map((m) => [m._id.toString(), m]));
  await Promise.all(
    enriched.map(async (featured) => {
      const raw = rawById.get(featured.id);
      if (!raw) return;
      featured.lineup = await buildMatchLineupPayload(raw, { fetchExternalShirts: false });
    })
  );
  return attachStreamMetaToMatches(enriched);
}

export function invalidateRankingFinishedMatchesCache() {
  cache.invalidate(CACHE_KEY);
}

export async function getCachedRankingFinishedMatches() {
  return cache.getOrCompute(
    CACHE_KEY,
    loadFinishedArchiveMatches,
    FINISHED_ARCHIVE_CACHE_TTL_MS
  );
}

/** Test helper */
export function clearRankingFinishedMatchesCache() {
  cache.clear();
}
