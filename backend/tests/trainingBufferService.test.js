import { describe, it, expect } from 'vitest';
import { computeScoreMse } from '../src/services/trainingBufferService.js';

describe('trainingBufferService', () => {
  describe('computeScoreMse', () => {
    it('devuelve 0 en acierto exacto', () => {
      expect(
        computeScoreMse({ home: 2, away: 1 }, { home: 2, away: 1 })
      ).toBe(0);
    });

    it('calcula MSE de goles', () => {
      expect(
        computeScoreMse({ home: 3, away: 0 }, { home: 1, away: 1 })
      ).toBe(4 + 1);
    });
  });
});
