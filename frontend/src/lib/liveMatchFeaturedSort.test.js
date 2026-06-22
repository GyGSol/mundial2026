import { describe, it, expect } from 'vitest';
import {
  compareLiveMatchesForFeaturedBar,
  liveMatchFeaturedSortTier,
  sortLiveMatchesForFeaturedBar,
} from './liveMatchFeaturedSort.js';

describe('liveMatchFeaturedSort', () => {
  const activeLater = {
    id: 'nor-sen',
    status: 'live',
    kickoffAt: '2026-06-21T00:00:00.000Z',
    weatherOps: { phase: 'normal' },
    matchPlayState: { phase: 'in_play' },
    raw: { time_elapsed: "12'" },
  };

  const suspendedEarlier = {
    id: 'fra-irq',
    status: 'live',
    kickoffAt: '2026-06-20T21:00:00.000Z',
    weatherOps: { phase: 'suspended' },
    matchPlayState: { phase: 'suspended', label: 'Suspendido por clima' },
    raw: { time_elapsed: "45+4'" },
  };

  it('prioriza partidos activos sobre suspendidos', () => {
    expect(liveMatchFeaturedSortTier(activeLater)).toBe(0);
    expect(liveMatchFeaturedSortTier(suspendedEarlier)).toBe(1);
    expect(compareLiveMatchesForFeaturedBar(activeLater, suspendedEarlier)).toBeLessThan(0);
  });

  it('ordena activos con kickoff más reciente primero', () => {
    const sorted = sortLiveMatchesForFeaturedBar([suspendedEarlier, activeLater]);
    expect(sorted.map((m) => m.id)).toEqual(['nor-sen', 'fra-irq']);
  });

  it('mantiene suspendidos abajo aunque reanuden tier activo', () => {
    const resumed = {
      ...suspendedEarlier,
      weatherOps: { phase: 'normal' },
      matchPlayState: { phase: 'in_play' },
      raw: { time_elapsed: "46'" },
    };
    const sorted = sortLiveMatchesForFeaturedBar([suspendedEarlier, resumed, activeLater]);
    expect(sorted[0].id).toBe('nor-sen');
    expect(sorted.map((m) => m.id)).toContain('fra-irq');
  });
});
