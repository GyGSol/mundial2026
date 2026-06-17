import { describe, it, expect } from 'vitest';
import { avgGoalDiffPerMatch, compareAvgGoalDiff } from '../src/services/goalDiffStats.js';

describe('goalDiffStats', () => {
  it('calcula promedio dif ÷ PJ', () => {
    expect(avgGoalDiffPerMatch(6, 10)).toBe(0.6);
    expect(avgGoalDiffPerMatch(1, 3)).toBeCloseTo(0.333, 3);
  });

  it('compareAvgGoalDiff prioriza menor promedio aunque el total acumulado sea mayor', () => {
    expect(compareAvgGoalDiff(5, 10, 2, 2)).toBeLessThan(0);
  });
});
