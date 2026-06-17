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

  it('goalDiffScore: .000 sin errores, sube con error combinado', () => {
    expect(goalDiffScore(0, 0, 5)).toBe(0);
    expect(goalDiffScore(29, 11, 20)).toBeCloseTo(0.199, 3);
    expect(goalDiffScore(25, 15, 20)).toBeCloseTo(0.234, 3);
    expect(goalDiffScore(8, 8, 2)).toBe(1);
  });

  it('compareGoalDiffScore prioriza menor error', () => {
    expect(compareGoalDiffScore(0, 0, 3, 0, 0, 3)).toBe(0);
    expect(compareGoalDiffScore(29, 11, 20, 25, 15, 20)).toBeLessThan(0);
  });
});
