import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  clearLeaderboardCache,
  getCachedLeaderboard,
  invalidateLeaderboardCache,
} from '../src/services/leaderboardCache.js';

vi.mock('../src/services/leaderboardService.js', () => ({
  getLeaderboard: vi.fn(async (groupId, limit, options) => ({
    groupId,
    limit,
    options,
  })),
}));

import { getLeaderboard } from '../src/services/leaderboardService.js';

describe('leaderboardCache', () => {
  beforeEach(() => {
    clearLeaderboardCache();
    vi.clearAllMocks();
  });

  it('reutiliza el leaderboard dentro del TTL', async () => {
    const first = await getCachedLeaderboard('group-1', 100);
    const second = await getCachedLeaderboard('group-1', 100);

    expect(first).toBe(second);
    expect(getLeaderboard).toHaveBeenCalledTimes(1);
  });

  it('cachea por separado excludeMatchIds', async () => {
    await getCachedLeaderboard('group-1', 100);
    await getCachedLeaderboard('group-1', 100, { excludeMatchIds: ['a'] });

    expect(getLeaderboard).toHaveBeenCalledTimes(2);
  });

  it('invalida por grupo', async () => {
    await getCachedLeaderboard('group-1', 100);
    invalidateLeaderboardCache('group-1');
    await getCachedLeaderboard('group-1', 100);

    expect(getLeaderboard).toHaveBeenCalledTimes(2);
  });
});
