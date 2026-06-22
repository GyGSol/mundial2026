import { describe, it, expect } from 'vitest';
import {
  computeScoreMse,
  serializeTrainingBufferRow,
} from '../src/services/trainingBufferService.js';

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

  describe('serializeTrainingBufferRow', () => {
    it('prioriza shadow Oracle para MSE y prompt de export', () => {
      const row = {
        matchId: 'abc',
        predictedScore: { home: 1, away: 0 },
        actualScore: { home: 3, away: 1 },
        mseError: 8,
        shadowOracle: {
          predictedScore: { home: 2, away: 1 },
          mseError: 2,
          source: 'cerebras-oracle',
        },
        promptContext: {
          homeTeam: { name: 'Local' },
          awayTeam: { name: 'Visitante' },
        },
        microEvents: [],
      };
      const serialized = serializeTrainingBufferRow(row);
      expect(serialized.mseError).toBe(2);
      expect(serialized.prompt).toContain('2-1');
      expect(serialized.metadata.shadow_oracle).toBe('cerebras-oracle');
      expect(serialized.metadata.published_mse_error).toBe(8);
    });
  });
});
