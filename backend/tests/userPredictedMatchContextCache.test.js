import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/services/predictedMatchContextService.js', () => ({
  buildUserPredictedMatchContext: vi.fn(async (userId) => ({
    userId,
    groups: [],
    resolvedKnockoutByExternalId: new Map(),
  })),
}));

import { buildUserPredictedMatchContext } from '../src/services/predictedMatchContextService.js';
import {
  clearUserPredictedMatchContextCache,
  getCachedUserPredictedMatchContext,
  invalidateUserPredictedMatchContext,
} from '../src/services/userPredictedMatchContextCache.js';

describe('userPredictedMatchContextCache', () => {
  beforeEach(() => {
    clearUserPredictedMatchContextCache();
    vi.clearAllMocks();
  });

  it('reutiliza el contexto por userId dentro del TTL', async () => {
    await getCachedUserPredictedMatchContext('user-1');
    await getCachedUserPredictedMatchContext('user-1');

    expect(buildUserPredictedMatchContext).toHaveBeenCalledTimes(1);
  });

  it('invalida el cache al guardar una predicción', async () => {
    await getCachedUserPredictedMatchContext('user-1');
    invalidateUserPredictedMatchContext('user-1');
    await getCachedUserPredictedMatchContext('user-1');

    expect(buildUserPredictedMatchContext).toHaveBeenCalledTimes(2);
  });

  it('deduplica requests concurrentes del mismo usuario', async () => {
    await Promise.all([
      getCachedUserPredictedMatchContext('user-1'),
      getCachedUserPredictedMatchContext('user-1'),
    ]);

    expect(buildUserPredictedMatchContext).toHaveBeenCalledTimes(1);
  });
});
