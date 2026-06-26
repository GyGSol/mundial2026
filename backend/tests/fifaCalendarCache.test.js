import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/services/worldCupApiClient.js', () => ({
  fetchWithRetry: vi.fn(),
}));

import { fetchWithRetry } from '../src/services/worldCupApiClient.js';
import {
  clearFifaCalendarCacheForTests,
  compactFifaCalendarEntry,
  getCachedAllCalendarMatches,
  invalidateFifaCalendarCache,
} from '../src/services/fifaApiClient.js';

describe('getCachedAllCalendarMatches', () => {
  beforeEach(() => {
    clearFifaCalendarCacheForTests();
    vi.mocked(fetchWithRetry).mockReset();
  });

  it('reutiliza el calendario compacto hasta invalidación explícita', async () => {
    vi.mocked(fetchWithRetry).mockResolvedValue({
      ok: true,
      json: async () => ({
        Results: [
          {
            IdMatch: '1',
            IdStage: 's1',
            MatchNumber: 1,
            Date: '2026-06-01T18:00:00Z',
            Home: { IdTeam: 'h1', Abbreviation: 'ARG', ExtraField: 'drop' },
            Away: { IdTeam: 'a1', Abbreviation: 'BRA' },
            UnusedPayload: { nested: true },
          },
        ],
      }),
    });

    const first = await getCachedAllCalendarMatches();
    const second = await getCachedAllCalendarMatches();

    expect(first).toEqual([
      {
        IdMatch: '1',
        IdStage: 's1',
        MatchNumber: 1,
        Date: '2026-06-01T18:00:00Z',
        Period: undefined,
        MatchStatus: undefined,
        HomeTeamScore: undefined,
        AwayTeamScore: undefined,
        Home: { IdTeam: 'h1', Abbreviation: 'ARG', IdCountry: undefined, Score: undefined, TeamName: undefined },
        Away: { IdTeam: 'a1', Abbreviation: 'BRA', IdCountry: undefined, Score: undefined, TeamName: undefined },
      },
    ]);
    expect(second).toBe(first);
    expect(first[0]).not.toHaveProperty('UnusedPayload');
    expect(fetchWithRetry).toHaveBeenCalledTimes(1);

    invalidateFifaCalendarCache();
    await getCachedAllCalendarMatches();
    expect(fetchWithRetry).toHaveBeenCalledTimes(2);
  });

  it('compactFifaCalendarEntry conserva solo campos usados', () => {
    const compact = compactFifaCalendarEntry({
      IdMatch: 'x',
      Home: { IdTeam: '1', Abbreviation: 'USA', Noise: true },
    });
    expect(compact.Home).toEqual({
      IdTeam: '1',
      Abbreviation: 'USA',
      IdCountry: undefined,
      Score: undefined,
      TeamName: undefined,
    });
    expect(compact.Home).not.toHaveProperty('Noise');
  });
});
