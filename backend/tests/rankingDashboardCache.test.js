import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  clearRankingDashboardCache,
  dashboardCacheTtlMs,
  getCachedRankingDashboard,
  invalidateRankingDashboardCache,
} from '../src/services/rankingDashboardCache.js';

vi.mock('../src/services/rankingDashboardService.js', () => ({
  getRankingDashboard: vi.fn(async (groupId, userId) => ({
    group: { id: groupId },
    leaderboard: [],
    liveMatches: [],
    userId: userId ? String(userId) : null,
  })),
}));

import { getRankingDashboard } from '../src/services/rankingDashboardService.js';

describe('rankingDashboardCache', () => {
  beforeEach(() => {
    clearRankingDashboardCache();
    vi.clearAllMocks();
  });

  it('reutiliza el dashboard dentro del TTL', async () => {
    const first = await getCachedRankingDashboard('group-1', 'user-1');
    const second = await getCachedRankingDashboard('group-1', 'user-1');

    expect(first).toBe(second);
    expect(getRankingDashboard).toHaveBeenCalledTimes(1);
  });

  it('cachea por separado por usuario', async () => {
    await getCachedRankingDashboard('group-1', 'user-1');
    await getCachedRankingDashboard('group-1', 'user-2');

    expect(getRankingDashboard).toHaveBeenCalledTimes(2);
  });

  it('invalida por grupo', async () => {
    await getCachedRankingDashboard('group-1', 'user-1');
    invalidateRankingDashboardCache('group-1');
    await getCachedRankingDashboard('group-1', 'user-1');

    expect(getRankingDashboard).toHaveBeenCalledTimes(2);
  });

  it('usa TTL corto con partidos en vivo o recién finalizados', () => {
    const now = Date.now();
    expect(
      dashboardCacheTtlMs({
        liveMatches: [{ id: '1' }],
        recentFinishedMatches: [],
      })
    ).toBe(5_000);
    expect(
      dashboardCacheTtlMs({
        liveMatches: [],
        recentFinishedMatches: [{ id: '1', kickoffAt: new Date(now - 60_000).toISOString() }],
      })
    ).toBe(5_000);
    expect(
      dashboardCacheTtlMs({
        liveMatches: [],
        recentFinishedMatches: [{ id: '1', kickoffAt: new Date(now - 8 * 60 * 60 * 1000).toISOString() }],
      })
    ).toBe(15_000);
  });
});
