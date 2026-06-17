import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  isInAiPredictionWindow,
  parseGeminiJsonResponse,
  clampGoals,
  computeHeuristicScore,
  callAiForScore,
  callGeminiForScore,
  callAiForText,
  getAiProviderOrder,
  hasAiProvider,
  askMatchAiFollowUp,
  buildVenueContextForPrompt,
  WORLD_CUP_MATCH_ANALYSIS_INSTRUCTIONS,
  AI_COMPETITOR_SCORING_INSTRUCTIONS,
  aiModelForScoreSource,
} from '../src/services/aiPredictionService.js';
import * as predictiveModelingService from '../src/services/predictiveModelingService.js';
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

  describe('callAiForScore', () => {
    const context = {
      homeTeam: { name: 'MEX', code: 'MEX', group: 'A' },
      awayTeam: { name: 'RSA', code: 'RSA', group: 'A' },
      groupStandings: [],
    };

    it('usa Cerebras como proveedor principal', async () => {
      const previousCerebrasKey = env.cerebrasApiKey;
      env.cerebrasApiKey = 'cerebras-test-key';

      const predictSpy = vi.spyOn(predictiveModelingService, 'predictScore').mockResolvedValue({
        homeGoals: 3,
        awayGoals: 1,
        reasoning: 'Cerebras favorito local',
        source: 'cerebras-oracle',
        oracle: {
          predicted_score: [3, 1],
          confidence_interval: 0.8,
          key_variable_impact: 'Cerebras favorito local',
          error_reduction_factor: 0.2,
        },
      });

      const result = await callAiForScore(context);

      expect(result).toMatchObject({
        homeGoals: 3,
        awayGoals: 1,
        reasoning: 'Cerebras favorito local',
        source: 'cerebras-oracle',
      });
      expect(predictSpy).toHaveBeenCalledOnce();

      predictSpy.mockRestore();
      env.cerebrasApiKey = previousCerebrasKey;
    });

    it('sin API key Oracle cae a heurística vía cadena de proveedores', async () => {
      const previousCerebrasKey = env.cerebrasApiKey;
      const previousGeminiKey = env.googleAiApiKey;
      const previousGroqKey = env.groqApiKey;
      env.cerebrasApiKey = '';
      env.googleAiApiKey = '';
      env.groqApiKey = '';

      const result = await callAiForScore(context);
      expect(result.source).toBe('heuristic');
      expect(result.homeGoals).toBeGreaterThanOrEqual(0);

      env.cerebrasApiKey = previousCerebrasKey;
      env.googleAiApiKey = previousGeminiKey;
      env.groqApiKey = previousGroqKey;
    });

    it('parsea respuesta Gemini mockeada', async () => {
      const previousCerebrasKey = env.cerebrasApiKey;
      const previousKey = env.googleAiApiKey;
      env.cerebrasApiKey = '';
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

      const result = await callAiForScore(context, { fetchImpl: mockFetch });

      expect(result).toEqual({
        homeGoals: 2,
        awayGoals: 1,
        reasoning: 'Local favorito',
        source: 'gemini',
      });
      expect(mockFetch).toHaveBeenCalledOnce();
      env.cerebrasApiKey = previousCerebrasKey;
      env.googleAiApiKey = previousKey;
    });

    it('usa Groq si Gemini falla', async () => {
      const previousCerebrasKey = env.cerebrasApiKey;
      const previousGeminiKey = env.googleAiApiKey;
      const previousGroqKey = env.groqApiKey;
      env.cerebrasApiKey = '';
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

      const result = await callAiForScore(context, { fetchImpl: mockFetch });

      expect(result).toEqual({
        homeGoals: 1,
        awayGoals: 0,
        reasoning: 'Groq backup',
        source: 'groq',
      });
      expect(mockFetch.mock.calls.some(([url]) => String(url).includes('groq.com'))).toBe(true);

      env.cerebrasApiKey = previousCerebrasKey;
      env.googleAiApiKey = previousGeminiKey;
      env.groqApiKey = previousGroqKey;
    });

    it('callGeminiForScore es alias de callAiForScore', () => {
      expect(callGeminiForScore).toBe(callAiForScore);
    });
  });

  describe('getAiProviderOrder', () => {
    it('pone cerebras primero por defecto y soporta singleProvider', () => {
      const prevDefault = env.aiDefaultProvider;
      const prevCerebras = env.cerebrasApiKey;
      const prevGemini = env.googleAiApiKey;
      const prevGroq = env.groqApiKey;

      env.aiDefaultProvider = 'cerebras';
      env.cerebrasApiKey = 'cerebras';
      env.googleAiApiKey = 'gemini';
      env.groqApiKey = 'groq';

      expect(getAiProviderOrder()).toEqual(['cerebras', 'gemini', 'groq']);
      expect(getAiProviderOrder({ singleProvider: true })).toEqual(['cerebras']);

      env.cerebrasApiKey = '';
      expect(getAiProviderOrder({ singleProvider: true })).toEqual(['gemini']);

      env.aiDefaultProvider = prevDefault;
      env.cerebrasApiKey = prevCerebras;
      env.googleAiApiKey = prevGemini;
      env.groqApiKey = prevGroq;
    });
  });

  describe('hasAiProvider', () => {
    it('es true si hay Cerebras, Gemini o Groq', () => {
      const prevCerebras = env.cerebrasApiKey;
      const prevGemini = env.googleAiApiKey;
      const prevGroq = env.groqApiKey;
      env.cerebrasApiKey = '';
      env.googleAiApiKey = '';
      env.groqApiKey = '';
      expect(hasAiProvider()).toBe(false);
      env.cerebrasApiKey = 'x';
      expect(hasAiProvider()).toBe(true);
      env.cerebrasApiKey = '';
      env.groqApiKey = 'x';
      expect(hasAiProvider()).toBe(true);
      env.cerebrasApiKey = prevCerebras;
      env.googleAiApiKey = prevGemini;
      env.groqApiKey = prevGroq;
    });
  });

  describe('callAiForText', () => {
    it('devuelve texto desde Cerebras mockeado', async () => {
      const previousCerebrasKey = env.cerebrasApiKey;
      const previousGroqKey = env.groqApiKey;
      const previousGeminiKey = env.googleAiApiKey;
      env.cerebrasApiKey = 'cerebras-test-key';
      env.googleAiApiKey = '';
      env.groqApiKey = 'groq-test-key';

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Por la baja del 9 titular.' } }],
        }),
      });

      const result = await callAiForText('pregunta', { fetchImpl: mockFetch });
      expect(result).toEqual({
        text: 'Por la baja del 9 titular.',
        source: 'cerebras',
      });

      env.cerebrasApiKey = previousCerebrasKey;
      env.googleAiApiKey = previousGeminiKey;
      env.groqApiKey = previousGroqKey;
    });
  });

  describe('buildVenueContextForPrompt', () => {
    it('incluye estadio, horario local y nota de fixture', () => {
      const kickoffAt = new Date('2026-06-15T20:00:00.000Z');
      const venue = buildVenueContextForPrompt(
        { kickoffAt, kickoffTimezone: 'America/Los_Angeles', stadiumId: '1' },
        {
          nameEn: 'SoFi Stadium',
          city: 'Los Angeles',
          country: 'USA',
          timezone: 'America/Los_Angeles',
          capacity: 70000,
        }
      );

      expect(venue.fixtureNote).toMatch(/solo orden en el fixture/i);
      expect(venue.stadium).toMatchObject({
        name: 'SoFi Stadium',
        city: 'Los Angeles',
        country: 'USA',
      });
      expect(venue.kickoffLocal).toMatch(/2026/i);
      expect(venue.analysisHints).toHaveLength(3);
    });
  });

  describe('WORLD_CUP_MATCH_ANALYSIS_INSTRUCTIONS', () => {
    it('aclara que local/visitante es solo fixture', () => {
      expect(WORLD_CUP_MATCH_ANALYSIS_INSTRUCTIONS).toMatch(/SOLO la posición en el fixture/i);
      expect(WORLD_CUP_MATCH_ANALYSIS_INSTRUCTIONS).toMatch(/temperatura/i);
    });
  });

  describe('AI_COMPETITOR_SCORING_INSTRUCTIONS', () => {
    it('prioriza PA, Gdif y contexto del torneo 2026', () => {
      expect(AI_COMPETITOR_SCORING_INSTRUCTIONS).toMatch(/PA = 3 pts/i);
      expect(AI_COMPETITOR_SCORING_INSTRUCTIONS).toMatch(/Gdif/i);
      expect(AI_COMPETITOR_SCORING_INSTRUCTIONS).toMatch(/mundial2026/i);
      expect(AI_COMPETITOR_SCORING_INSTRUCTIONS).toMatch(/calibracionReciente/i);
    });
  });

  describe('aiModelForScoreSource', () => {
    it('mapea fuentes heurísticas externas', () => {
      expect(aiModelForScoreSource('heuristic-xg')).toBe('heuristic-xg');
      expect(aiModelForScoreSource('heuristic-odds')).toBe('heuristic-odds');
      expect(aiModelForScoreSource('heuristic')).toBe('heuristic');
    });
  });

  describe('askMatchAiFollowUp', () => {
    it('rechaza pregunta vacía', async () => {
      await expect(
        askMatchAiFollowUp('000000000000000000000001', '000000000000000000000002', {
          question: '   ',
          insight: { homeGoals: 1, awayGoals: 0, reasoning: 'Local favorito' },
        })
      ).rejects.toThrow('Escribí una pregunta');
    });
  });
});
