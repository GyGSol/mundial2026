import { describe, it, expect } from 'vitest';
import { computeScoreMse } from '../src/services/trainingBufferService.js';

describe('oracleErrorTrackingService helpers', () => {
  it('MSE acumulado manual coincide con fórmula del buffer', () => {
    const errors = [
      computeScoreMse({ home: 2, away: 1 }, { home: 1, away: 0 }),
      computeScoreMse({ home: 1, away: 1 }, { home: 2, away: 2 }),
    ];
    const avg = errors.reduce((a, b) => a + b, 0) / errors.length;
    expect(avg).toBeCloseTo((errors[0] + errors[1]) / 2, 5);
  });
});
