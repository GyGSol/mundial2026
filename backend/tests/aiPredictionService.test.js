import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  isInAiPredictionWindow,
  parseGeminiJsonResponse,
  clampGoals,
  computeHeuristicScore,
  callGeminiForScore,
} from '../src/services/aiPredictionService.js';
import { env } from '../src/config/env.js';

const kickoff = new Date('2026-06-15T20:00:00.000Z');
const match = { status: 'upcoming', kickoffAt: kickoff };

describe('aiPredictionService', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('isInAiPredictionWindow', () => {
    it('incluye partido ~90 min antes del kickoff (18:25 para kickoff 20:00)', () => {
      vi.setSystemTime(new Date('2026-06-15T18:25:00.000Z'));
      expect(isInAiPredictionWindow(match)).toBe(true);
    });

    it('excluye demasiado pronto (17:00)', () => {
      vi.setSystemTime(new Date('2026-06-15T17:00:00.000Z'));
      expect(isInAiPredictionWindow(match)).toBe(false);
    });

    it('excluye demasiado tarde (19:30)', () => {
      vi.setSystemTime(new Date('2026-06-15T19:30:00.000Z'));
      expect(isInAiPredictionWindow(match)).toBe(false);
    });

    it('ignora partidos no upcoming', () => {
      vi.setSystemTime(new Date('2026-06-15T18:25:00.000Z'));
      expect(isInAiPredictionWindow({ ...match, status: 'live' })).toBe(false);
    });
  });

  describe('parseGeminiJsonResponse', () => {
    it('parsea JSON directo', () => {
      expect(parseGeminiJsonResponse('{"homeGoals":2,"awayGoals":1}')).toEqual({
        homeGoals: 2,
        awayGoals: 1,
      });
    });

    it('extrae JSON de bloque markdown', () => {
      const raw = '```json\n{"homeGoals": 3, "awayGoals": 0, "reasoning": "test"}\n```';
      expect(parseGeminiJsonResponse(raw)).toEqual({
        homeGoals: 3,
        awayGoals: 0,
        reasoning: 'test',
      });
    });

    it('devuelve null si no hay JSON válido', () => {
      expect(parseGeminiJsonResponse('sin json')).toBeNull();
    });
  });

  describe('clampGoals', () => {
    it('acepta enteros 0-10', () => {
      expect(clampGoals(0)).toBe(0);
      expect(clampGoals(10)).toBe(10);
      expect(clampGoals(2.6)).toBe(3);
    });

    it('rechaza fuera de rango', () => {
      expect(clampGoals(-1)).toBeNull();
      expect(clampGoals(11)).toBeNull();
      expect(clampGoals('x')).toBeNull();
    });
  });

  describe('computeHeuristicScore', () => {
    it('devuelve enteros 0-10', () => {
      const context = {
        homeTeam: { externalId: '1', group: 'A' },
        awayTeam: { externalId: '2', group: 'A' },
        groupStandings: [
          {
            group: 'A',
            standings: [
              {
                teamId: '1',
                nameEn: 'Mexico',
                played: 2,
                goalsFor: 4,
                goalsAgainst: 1,
              },
              {
                teamId: '2',
                nameEn: 'South Africa',
                played: 2,
                goalsFor: 1,
                goalsAgainst: 3,
              },
            ],
          },
        ],
      };

      const score = computeHeuristicScore(context);
      expect(score.homeGoals).toBeGreaterThanOrEqual(0);
      expect(score.homeGoals).toBeLessThanOrEqual(10);
      expect(score.awayGoals).toBeGreaterThanOrEqual(0);
      expect(score.awayGoals).toBeLessThanOrEqual(10);
      expect(score.source).toBe('heuristic');
    });
  });

  describe('callGeminiForScore', () => {
    const context = {
      homeTeam: { name: 'MEX', code: 'MEX', group: 'A' },
      awayTeam: { name: 'RSA', code: 'RSA', group: 'A' },
      groupStandings: [],
    };

    it('parsea respuesta Gemini mockeada', async () => {
      const previousKey = env.googleAiApiKey;
      env.googleAiApiKey = 'test-key';

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: '{"homeGoals":2,"awayGoals":1,"reasoning":"Local favorito"}' }],
              },
            },
          ],
        }),
      });

      const result = await callGeminiForScore(context, { fetchImpl: mockFetch });

      expect(result).toEqual({
        homeGoals: 2,
        awayGoals: 1,
        reasoning: 'Local favorito',
        source: 'gemini',
      });
      expect(mockFetch).toHaveBeenCalledOnce();
      env.googleAiApiKey = previousKey;
    });

    it('usa Groq si Gemini falla', async () => {
      const previousGeminiKey = env.googleAiApiKey;
      const previousGroqKey = env.groqApiKey;
      env.googleAiApiKey = 'test-key';
      env.groqApiKey = 'groq-test-key';

      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => 'server error',
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => 'server error',
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => 'server error',
        })
        .mockResolvedValue({
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: '{"homeGoals":1,"awayGoals":0,"reasoning":"Groq backup"}',
                },
              },
            ],
          }),
        });

      const result = await callGeminiForScore(context, { fetchImpl: mockFetch });

      expect(result).toEqual({
        homeGoals: 1,
        awayGoals: 0,
        reasoning: 'Groq backup',
        source: 'groq',
      });
      expect(mockFetch.mock.calls.some(([url]) => String(url).includes('groq.com'))).toBe(true);

      env.googleAiApiKey = previousGeminiKey;
      env.groqApiKey = previousGroqKey;
    });
  });
});
