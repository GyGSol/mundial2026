import { Match } from '../models/Match.js';
import {
  enrichMatchesForRankingDashboard,
  prepareFifaShirtMapsForMatches,
} from './matchEnrichmentService.js';
import { attachStreamMetaToMatches } from './streamMetaService.js';
import { createInMemoryCache } from './inMemoryCache.js';

/** Partidos finalizados en el archivo colapsable del ranking (más recientes primero). */
export const FINISHED_ARCHIVE_LIMIT = 40;

/** Partidos finalizados: datos estables; TTL largo salvo invalidación explícita. */
export const FINISHED_ARCHIVE_CACHE_TTL_MS = 30 * 60 * 1000;

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
  const enriched = await enrichMatchesForRankingDashboard(finishedArchiveRaw, null);
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
