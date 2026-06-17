import { describe, it, expect } from 'vitest';
import {
  avgGoalDiffPerMatch,
  compareAvgGoalDiff,
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

  it('goalDiffScore: (GLdif × GVdif) / 2 escalado; 1.000 sin errores', () => {
    expect(goalDiffScore(0, 0, 5)).toBe(1);
    expect(goalDiffScore(29, 11, 20)).toBeCloseTo(0.801, 3);
    expect(goalDiffScore(25, 15, 20)).toBeCloseTo(0.766, 3);
    expect(goalDiffScore(8, 8, 2)).toBe(0);
  });

  it('compareGoalDiffScore prioriza mayor Gdif', () => {
    expect(compareGoalDiffScore(0, 0, 3, 0, 0, 3)).toBe(0);
    expect(compareGoalDiffScore(25, 15, 20, 29, 11, 20)).toBeGreaterThan(0);
  });
});
