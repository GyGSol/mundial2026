import { describe, it, expect } from 'vitest';
import {
  avgGoalDiffPerMatch,
  compareAvgGoalDiff,
  compareHitRate,
  goalDiffScore,
  compareGoalDiffScore,
} from '../src/services/goalDiffStats.js';

describe('goalDiffStats', () => {
  it('calcula promedio dif ÷ PJ', () => {
    expect(avgGoalDiffPerMatch(6, 10)).toBe(0.6);
    expect(avgGoalDiffPerMatch(1, 3)).toBeCloseTo(0.333, 3);
  });

  it('compareAvgGoalDiff prioriza menor promedio aunque el total acumulado sea mayor', () => {
    expect(compareAvgGoalDiff(5, 10, 2, 2)).toBeLessThan(0);
  });

  it('goalDiffScore: (GL/PJ × GV/PJ)/2 escalado; 1.000 = todos exactos', () => {
    expect(goalDiffScore(2, 2, 2)).toBe(1);
    expect(goalDiffScore(1, 1, 1)).toBe(1);
    expect(goalDiffScore(1, 0, 1)).toBe(0);
    expect(goalDiffScore(2, 1, 2)).toBe(0.5);
    expect(goalDiffScore(4, 11, 20)).toBeCloseTo(0.11, 3);
    expect(goalDiffScore(4, 7, 20)).toBeCloseTo(0.07, 3);
  });

  it('compareGoalDiffScore prioriza mayor Gdif', () => {
    expect(compareGoalDiffScore(2, 2, 2, 2, 2, 2)).toBe(0);
    expect(compareGoalDiffScore(1, 1, 2, 2, 2, 2)).toBeGreaterThan(0);
  });

  it('compareHitRate prioriza mayor tasa de acierto', () => {
    expect(compareHitRate(2, 20, 4, 20)).toBeGreaterThan(0);
  });
});
