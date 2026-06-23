import { describe, it, expect } from 'vitest';
import {
  buildStatIndicatorMatchIds,
  liveMatchIdsForStatIndicators,
} from '../src/services/rankingDashboardService.js';

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

  it('combina en vivo + recién finalizados sin duplicar, en vivo primero', () => {
    expect(
      buildStatIndicatorMatchIds(['live-a', 'live-b'], ['finished-a', 'live-b'])
    ).toEqual(['live-a', 'live-b', 'finished-a']);
  });

  it('mantiene flechas con solo partido recién finalizado en gracia', () => {
    expect(buildStatIndicatorMatchIds([], ['francia-finished'])).toEqual(['francia-finished']);
  });
});
