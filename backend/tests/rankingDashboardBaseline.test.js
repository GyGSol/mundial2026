import { describe, it, expect } from 'vitest';
import { liveMatchIdsForStatIndicators } from '../src/services/rankingDashboardService.js';

describe('ranking dashboard live stat indicator baseline', () => {
  it('solo incluye partidos en vivo, sin duplicar', () => {
    expect(liveMatchIdsForStatIndicators(['live-a', 'live-b', 'live-a'])).toEqual([
      'live-a',
      'live-b',
    ]);
  });

  it('devuelve vacío si no hay partidos en vivo', () => {
    expect(liveMatchIdsForStatIndicators([])).toEqual([]);
  });
});
