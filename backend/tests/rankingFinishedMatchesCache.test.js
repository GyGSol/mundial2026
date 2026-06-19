import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  clearRankingFinishedMatchesCache,
  FINISHED_ARCHIVE_CACHE_TTL_MS,
  getCachedRankingFinishedMatches,
  invalidateRankingFinishedMatchesCache,
} from '../src/services/rankingFinishedMatchesCache.js';

vi.mock('../src/models/Match.js', () => ({
  Match: {
    find: vi.fn(() => ({
      sort: vi.fn(() => ({
        limit: vi.fn(() => ({
          lean: vi.fn(async () => [{ _id: 'm1', externalId: '25', status: 'finished' }]),
        })),
      })),
    })),
  },
}));

vi.mock('../src/services/matchEnrichmentService.js', () => ({
  prepareFifaShirtMapsForMatches: vi.fn(async () => {}),
  enrichMatchesForRankingDashboard: vi.fn(async (matches) =>
    matches.map((m) => ({ id: String(m._id), externalId: m.externalId, status: 'finished' }))
  ),
}));

vi.mock('../src/services/streamMetaService.js', () => ({
  attachStreamMetaToMatches: vi.fn(async (matches) => matches),
}));

describe('rankingFinishedMatchesCache', () => {
  beforeEach(() => {
    clearRankingFinishedMatchesCache();
    vi.clearAllMocks();
  });

  it('reutiliza el archivo enriquecido dentro del TTL', async () => {
    const first = await getCachedRankingFinishedMatches();
    const second = await getCachedRankingFinishedMatches();

    expect(first).toBe(second);
    expect(first).toHaveLength(1);
    expect(FINISHED_ARCHIVE_CACHE_TTL_MS).toBeGreaterThanOrEqual(30 * 60 * 1000);
  });

  it('recarga tras invalidación', async () => {
    const first = await getCachedRankingFinishedMatches();
    invalidateRankingFinishedMatchesCache();
    const second = await getCachedRankingFinishedMatches();

    expect(first).not.toBe(second);
    expect(first[0].externalId).toBe(second[0].externalId);
  });
});
