import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  clearWorldCupOverviewCache,
  getCachedWorldCupOverview,
  invalidateWorldCupOverviewCache,
} from '../src/services/worldCupOverviewCache.js';

vi.mock('../src/services/worldCupStatsService.js', () => ({
  buildWorldCupOverview: vi.fn(async ({ includePlayerStats }) => ({
    stats: { matches: { live: 0 } },
    tournament2026PlayerStats: includePlayerStats ? { leaders: [] } : null,
  })),
}));

vi.mock('../src/models/Match.js', () => ({ Match: {} }));
vi.mock('../src/models/Team.js', () => ({ Team: {} }));
vi.mock('../src/models/Group.js', () => ({ Group: {} }));
vi.mock('../src/models/Stadium.js', () => ({ Stadium: {} }));
vi.mock('../src/services/syncService.js', () => ({
  getLastSyncAt: vi.fn(async () => null),
}));

import { buildWorldCupOverview } from '../src/services/worldCupStatsService.js';

describe('worldCupOverviewCache', () => {
  beforeEach(() => {
    clearWorldCupOverviewCache();
    vi.clearAllMocks();
  });

  it('reutiliza el overview base dentro del TTL', async () => {
    const first = await getCachedWorldCupOverview();
    const second = await getCachedWorldCupOverview();

    expect(first).toBe(second);
    expect(buildWorldCupOverview).toHaveBeenCalledTimes(1);
    expect(buildWorldCupOverview).toHaveBeenCalledWith(
      expect.objectContaining({ includePlayerStats: false })
    );
  });

  it('cachea por separado cuando se piden estadísticas de jugadores', async () => {
    await getCachedWorldCupOverview();
    await getCachedWorldCupOverview({ includePlayerStats: true });

    expect(buildWorldCupOverview).toHaveBeenCalledTimes(2);
  });

  it('invalida todas las entradas', async () => {
    await getCachedWorldCupOverview();
    invalidateWorldCupOverviewCache();
    await getCachedWorldCupOverview();

    expect(buildWorldCupOverview).toHaveBeenCalledTimes(2);
  });
});
