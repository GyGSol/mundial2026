import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  clearRankingDashboardShellCache,
  getCachedRankingDashboardShell,
} from '../src/services/rankingDashboardShellCache.js';

describe('rankingDashboardShellCache', () => {
  beforeEach(() => {
    clearRankingDashboardShellCache();
  });

  it('reutiliza el shell dentro del TTL para la misma firma de partidos', async () => {
    const compute = vi.fn(async () => ({ leaderboard: [{ id: 'u1' }] }));

    const first = await getCachedRankingDashboardShell('g1', 'u1', 'sig-a', compute, {
      hasLiveOrRecent: true,
    });
    const second = await getCachedRankingDashboardShell('g1', 'u1', 'sig-a', compute, {
      hasLiveOrRecent: true,
    });

    expect(first).toBe(second);
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('recalcula cuando cambia la firma de partidos en vivo', async () => {
    const compute = vi.fn(async () => ({ leaderboard: [] }));

    await getCachedRankingDashboardShell('g1', 'u1', 'sig-a', compute, {
      hasLiveOrRecent: true,
    });
    await getCachedRankingDashboardShell('g1', 'u1', 'sig-b', compute, {
      hasLiveOrRecent: true,
    });

    expect(compute).toHaveBeenCalledTimes(2);
  });
});
