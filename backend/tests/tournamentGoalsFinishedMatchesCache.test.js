import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  clearTournamentGoalsFinishedMatchesCache,
  getCachedTournamentGoalCountsBundle,
  invalidateTournamentGoalsFinishedMatchesCache,
  TOURNAMENT_GOALS_FINISHED_CACHE_TTL_MS,
} from '../src/services/tournamentGoalsFinishedMatchesCache.js';

vi.mock('../src/models/Match.js', () => ({
  Match: {
    find: vi.fn(() => ({
      select: vi.fn(() => ({
        lean: vi.fn(async () => [
          {
            externalId: 'm1',
            raw: { fifaEvents: { timeline: [{ type: 'goal', player: 'A', side: 'home' }] } },
          },
        ]),
      })),
    })),
  },
}));

describe('tournamentGoalsFinishedMatchesCache', () => {
  beforeEach(() => {
    clearTournamentGoalsFinishedMatchesCache();
    vi.clearAllMocks();
  });

  it('reutiliza bundle de goles hasta invalidación explícita', async () => {
    const first = await getCachedTournamentGoalCountsBundle();
    const second = await getCachedTournamentGoalCountsBundle();

    expect(first).toBe(second);
    expect(first.globalCounts.get('name:a')).toBe(1);
    expect(TOURNAMENT_GOALS_FINISHED_CACHE_TTL_MS).toBe(Number.POSITIVE_INFINITY);
  });

  it('recarga tras invalidación', async () => {
    const first = await getCachedTournamentGoalCountsBundle();
    invalidateTournamentGoalsFinishedMatchesCache();
    const second = await getCachedTournamentGoalCountsBundle();

    expect(first).not.toBe(second);
  });
});
