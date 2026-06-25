import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/services/worldCupApiClient.js', () => ({
  fetchWithRetry: vi.fn(),
}));

import { fetchWithRetry } from '../src/services/worldCupApiClient.js';
import {
  clearFifaCalendarCacheForTests,
  getCachedAllCalendarMatches,
} from '../src/services/fifaApiClient.js';

describe('getCachedAllCalendarMatches', () => {
  beforeEach(() => {
    clearFifaCalendarCacheForTests();
    vi.mocked(fetchWithRetry).mockReset();
  });

  it('reutiliza el calendario dentro del TTL', async () => {
    vi.mocked(fetchWithRetry).mockResolvedValue({
      ok: true,
      json: async () => ({ Results: [{ IdMatch: '1' }] }),
    });

    const first = await getCachedAllCalendarMatches();
    const second = await getCachedAllCalendarMatches();

    expect(first).toEqual([{ IdMatch: '1' }]);
    expect(second).toBe(first);
    expect(fetchWithRetry).toHaveBeenCalledTimes(1);
  });
});
