import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  parseOracleStructuredResponse,
  predictScore,
  resetLiveAdjustmentCacheForTests,
} from '../src/services/predictiveModelingService.js';
import { env } from '../src/config/env.js';

describe('predictiveModelingService', () => {
  afterEach(() => {
    resetLiveAdjustmentCacheForTests();
    vi.restoreAllMocks();
  });

  describe('parseOracleStructuredResponse', () => {
    it('parsea JSON Oracle estricto', () => {
      const result = parseOracleStructuredResponse({
        predicted_score: [2, 1],
        confidence_interval: 0.72,
        key_variable_impact: 'Forma local en el torneo',
        error_reduction_factor: 0.15,
      });
      expect(result).toMatchObject({
        homeGoals: 2,
        awayGoals: 1,
        source: 'cerebras-oracle',
        oracle: {
          predicted_score: [2, 1],
          confidence_interval: 0.72,
          key_variable_impact: 'Forma local en el torneo',
          error_reduction_factor: 0.15,
        },
      });
    });

    it('rechaza marcadores inválidos', () => {
      expect(parseOracleStructuredResponse({ predicted_score: [11, 0] })).toBeNull();
    });
  });

  describe('predictScore', () => {
    it('devuelve null sin API key', async () => {
      const prev = env.cerebrasApiKey;
      env.cerebrasApiKey = '';
      const score = await predictScore({
        homeTeam: { fifaRanking: { rank: 5 } },
        awayTeam: { fifaRanking: { rank: 20 } },
      });
      expect(score).toBeNull();
      env.cerebrasApiKey = prev;
    });
  });
});
