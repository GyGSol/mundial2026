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

  it('goalDiffScore es 1.000 sin errores y baja con dif combinada', () => {
    expect(goalDiffScore(0, 0, 5)).toBe(1);
    expect(goalDiffScore(2, 0, 1)).toBe(0.5);
    expect(goalDiffScore(4, 4, 2)).toBe(0);
  });

  it('compareGoalDiffScore prioriza mayor Gdif', () => {
    expect(compareGoalDiffScore(0, 0, 3, 0, 0, 3)).toBe(0);
    expect(compareGoalDiffScore(2, 0, 2, 0, 0, 2)).toBeGreaterThan(0);
  });
});
