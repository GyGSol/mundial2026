import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  parseOracleStructuredResponse,
  predictScore,
  callCerebrasOracleViaFetch,
  buildOraclePromptFromFrozenContext,
  resetLiveAdjustmentCacheForTests,
} from '../src/services/predictiveModelingService.js';
import { env } from '../src/config/env.js';

describe('predictiveModelingService', () => {
  afterEach(() => {
    resetLiveAdjustmentCacheForTests();
    vi.restoreAllMocks();
  });

  describe('parseOracleStructuredResponse', () => {
    it('parsea JSON Oracle estricto con reasoning completo', () => {
      const result = parseOracleStructuredResponse({
        home_goals: 2,
        away_goals: 1,
        confidence_interval: 0.72,
        reasoning:
          '**Forma en el torneo:** Ghana suma pocos goles en 2026. **Clima:** calor en la sede favorece ritmo bajo. El ranking FIFA no define el partido.',
        key_variable_impact: 'Goles a favor en fase de grupos 2026',
        error_reduction_factor: 0.15,
      });
      expect(result).toMatchObject({
        homeGoals: 2,
        awayGoals: 1,
        reasoning: expect.stringContaining('Forma en el torneo'),
        source: 'cerebras-oracle',
        oracle: {
          predicted_score: [2, 1],
          confidence_interval: 0.72,
          key_variable_impact: 'Goles a favor en fase de grupos 2026',
          error_reduction_factor: 0.15,
        },
      });
      expect(result.reasoning).not.toBe(result.oracle.key_variable_impact);
    });

    it('retrocompatible sin campo reasoning (usa key_variable_impact)', () => {
      const result = parseOracleStructuredResponse({
        predicted_score: [1, 0],
        confidence_interval: 0.5,
        key_variable_impact: 'Forma local en el torneo',
        error_reduction_factor: 0.1,
      });
      expect(result?.reasoning).toContain('Forma local');
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

  describe('callCerebrasOracleViaFetch', () => {
    it('parsea respuesta Oracle vía fetch mock', async () => {
      const prev = env.cerebrasApiKey;
      env.cerebrasApiKey = 'test-key';

      const oracleJson = JSON.stringify({
        home_goals: 2,
        away_goals: 1,
        confidence_interval: 0.8,
        reasoning: '**Forma:** local superior.',
        key_variable_impact: 'Ranking FIFA',
        error_reduction_factor: 0.2,
      });

      const fetchImpl = vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: oracleJson } }],
        }),
      }));

      const result = await callCerebrasOracleViaFetch('prompt test', { fetchImpl });
      expect(result).toMatchObject({
        homeGoals: 2,
        awayGoals: 1,
        source: 'cerebras-oracle',
      });
      expect(fetchImpl).toHaveBeenCalledOnce();

      env.cerebrasApiKey = prev;
    });

    it('devuelve null sin API key', async () => {
      const prev = env.cerebrasApiKey;
      env.cerebrasApiKey = '';
      const result = await callCerebrasOracleViaFetch('x', {
        fetchImpl: vi.fn(),
      });
      expect(result).toBeNull();
      env.cerebrasApiKey = prev;
    });
  });

  describe('buildOraclePromptFromFrozenContext', () => {
    it('incluye equipos del contexto congelado', () => {
      const prompt = buildOraclePromptFromFrozenContext({
        homeTeam: { name: 'Francia', code: 'FRA' },
        awayTeam: { name: 'Irak', code: 'IRQ' },
        match: { group: 'A' },
      });
      expect(prompt).toContain('Francia');
      expect(prompt).toContain('Irak');
    });
  });
});
