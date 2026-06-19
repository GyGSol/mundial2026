import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  clearTournamentGoalsFinishedMatchesCache,
  getCachedFinishedMatchesForTournamentGoals,
  invalidateTournamentGoalsFinishedMatchesCache,
  TOURNAMENT_GOALS_FINISHED_CACHE_TTL_MS,
} from '../src/services/tournamentGoalsFinishedMatchesCache.js';

vi.mock('../src/models/Match.js', () => ({
  Match: {
    find: vi.fn(() => ({
      select: vi.fn(() => ({
        lean: vi.fn(async () => [{ externalId: 'm1', raw: {} }]),
      })),
    })),
  },
}));

describe('tournamentGoalsFinishedMatchesCache', () => {
  beforeEach(() => {
    clearTournamentGoalsFinishedMatchesCache();
    vi.clearAllMocks();
  });

  it('reutiliza partidos finalizados dentro del TTL', async () => {
    const first = await getCachedFinishedMatchesForTournamentGoals();
    const second = await getCachedFinishedMatchesForTournamentGoals();

    expect(first).toBe(second);
    expect(first).toHaveLength(1);
    expect(TOURNAMENT_GOALS_FINISHED_CACHE_TTL_MS).toBe(60_000);
  });

  it('recarga tras invalidación', async () => {
    const first = await getCachedFinishedMatchesForTournamentGoals();
    invalidateTournamentGoalsFinishedMatchesCache();
    const second = await getCachedFinishedMatchesForTournamentGoals();

    expect(first).not.toBe(second);
  });
});
