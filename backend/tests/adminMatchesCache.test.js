import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  clearAdminMatchesCache,
  getCachedAdminMatches,
  invalidateAdminMatchesCache,
} from '../src/services/adminMatchesCache.js';

vi.mock('../src/services/adminService.js', () => ({
  listAdminMatches: vi.fn(async (filters) => [{ id: 'm1', ...filters }]),
}));

describe('adminMatchesCache', () => {
  beforeEach(() => {
    clearAdminMatchesCache();
    vi.clearAllMocks();
  });

  it('reutiliza la lista dentro del TTL', async () => {
    const first = await getCachedAdminMatches({ status: 'live' });
    const second = await getCachedAdminMatches({ status: 'live' });

    expect(first).toBe(second);
    const { listAdminMatches } = await import('../src/services/adminService.js');
    expect(listAdminMatches).toHaveBeenCalledTimes(1);
  });

  it('cachea por separado según filtros', async () => {
    await getCachedAdminMatches({ status: 'live' });
    await getCachedAdminMatches({ status: 'finished' });

    const { listAdminMatches } = await import('../src/services/adminService.js');
    expect(listAdminMatches).toHaveBeenCalledTimes(2);
  });

  it('invalida todas las entradas', async () => {
    await getCachedAdminMatches({ status: 'live' });
    invalidateAdminMatchesCache();
    await getCachedAdminMatches({ status: 'live' });

    const { listAdminMatches } = await import('../src/services/adminService.js');
    expect(listAdminMatches).toHaveBeenCalledTimes(2);
  });
});
