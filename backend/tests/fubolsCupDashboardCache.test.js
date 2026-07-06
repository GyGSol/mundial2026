import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  clearFubolsCupDashboardCache,
  fubolsCupDashboardCacheTtlMs,
  getCachedFubolsCupDashboard,
  invalidateFubolsCupDashboardCache,
} from '../src/services/fubolsCupDashboardCache.js';

vi.mock('../src/services/fubolsCupService.js', () => ({
  getFubolsCupDashboard: vi.fn(async (groupId, viewerUserId) => ({
    tournament: { status: 'preview' },
    groupId,
    viewerUserId,
    rounds: [],
  })),
}));

import { getFubolsCupDashboard } from '../src/services/fubolsCupService.js';

describe('fubolsCupDashboardCache', () => {
  beforeEach(() => {
    clearFubolsCupDashboardCache();
    vi.mocked(getFubolsCupDashboard).mockClear();
  });

  it('deduplica requests concurrentes por groupId y usuario', async () => {
    const [a, b] = await Promise.all([
      getCachedFubolsCupDashboard('group-1', 'user-1'),
      getCachedFubolsCupDashboard('group-1', 'user-1'),
    ]);
    expect(a).toEqual(b);
    expect(getFubolsCupDashboard).toHaveBeenCalledTimes(1);
  });

  it('invalida por prefijo de grupo', async () => {
    await getCachedFubolsCupDashboard('group-1', 'user-1');
    await getCachedFubolsCupDashboard('group-1', 'user-2');
    invalidateFubolsCupDashboardCache('group-1');
    await getCachedFubolsCupDashboard('group-1', 'user-1');
    expect(getFubolsCupDashboard).toHaveBeenCalledTimes(3);
  });

  it('usa TTL más corto cuando hay partidos en vivo', () => {
    expect(
      fubolsCupDashboardCacheTtlMs({
        tournament: { status: 'running' },
        rounds: [
          {
            duels: [{ worldCupMatches: [{ match: { status: 'live' } }] }],
          },
        ],
      })
    ).toBe(10_000);
    expect(
      fubolsCupDashboardCacheTtlMs({
        tournament: { status: 'completed' },
        rounds: [],
      })
    ).toBe(60_000);
  });
});
