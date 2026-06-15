import { describe, it, expect } from 'vitest';
import {
  finishedMatchIdsForPointsBaseline,
  mergePointsBaselineMatchIds,
} from '../src/services/rankingDashboardService.js';

describe('ranking dashboard points baseline match ids', () => {
  const now = new Date('2026-06-14T03:00:00.000Z').getTime();

  it('incluye partidos finalizados con kickoff reciente', () => {
    const finished = [
      { _id: { toString: () => 'recent' }, kickoffAt: new Date('2026-06-14T01:00:00.000Z') },
      { _id: { toString: () => 'old' }, kickoffAt: new Date('2026-06-10T01:00:00.000Z') },
    ];

    expect(finishedMatchIdsForPointsBaseline(finished, now)).toEqual(['recent']);
  });

  it('une en vivo y recién finalizados sin duplicar', () => {
    const finished = [
      { _id: { toString: () => 'same' }, kickoffAt: new Date('2026-06-14T01:00:00.000Z') },
    ];

    expect(mergePointsBaselineMatchIds(['live-a', 'same'], finished, now)).toEqual([
      'live-a',
      'same',
    ]);
  });
});
