import { describe, it, expect } from 'vitest';
import {
  scoreFromExternalIntel,
  formatExternalIntelForPrompt,
} from '../src/services/externalMatchIntelService.js';
import { computeHeuristicScore } from '../src/services/aiPredictionService.js';

describe('externalMatchIntelService', () => {
  it('scoreFromExternalIntel usa xG cuando está disponible', () => {
    const score = scoreFromExternalIntel({
      xg: { homeExpected: 1.8, awayExpected: 0.9, source: 'api-football' },
    });
    expect(score).toEqual({
      homeGoals: 2,
      awayGoals: 1,
      reasoning: 'Heurística por xG externo',
      source: 'heuristic-xg',
    });
  });

  it('scoreFromExternalIntel usa odds implícitas sin xG', () => {
    const score = scoreFromExternalIntel({
      impliedProbabilities: { home: 0.55, draw: 0.25, away: 0.2 },
    });
    expect(score.source).toBe('heuristic-odds');
    expect(score.homeGoals).toBeGreaterThanOrEqual(0);
  });

  it('formatExternalIntelForPrompt expone bloques legibles', () => {
    const formatted = formatExternalIntelForPrompt({
      odds: { home: 2.1, draw: 3.2, away: 3.5 },
      impliedProbabilities: { home: 0.45, draw: 0.3, away: 0.25 },
      xg: { homeExpected: 1.2, awayExpected: 1.1 },
      fetchedAt: '2026-06-01T00:00:00.000Z',
    });
    expect(formatted.cuotas.home).toBe(2.1);
    expect(formatted.xgEsperado.homeExpected).toBe(1.2);
  });
});

describe('computeHeuristicScore con mercado', () => {
  it('prioriza intel externa sobre standings', () => {
    const score = computeHeuristicScore({
      externalIntel: {
        xg: { homeExpected: 2.4, awayExpected: 0.6 },
      },
      groupStandings: [],
      homeTeam: { externalId: '1' },
      awayTeam: { externalId: '2' },
    });
    expect(score.source).toBe('heuristic-xg');
    expect(score.homeGoals).toBe(2);
    expect(score.awayGoals).toBe(1);
  });

  it('acepta mercadoYxG formateado para prompt', () => {
    const score = computeHeuristicScore({
      mercadoYxG: {
        xgEsperado: { homeExpected: 1.1, awayExpected: 1.9 },
      },
      groupStandings: [],
      homeTeam: { externalId: '1' },
      awayTeam: { externalId: '2' },
    });
    expect(score.source).toBe('heuristic-xg');
    expect(score.homeGoals).toBe(1);
    expect(score.awayGoals).toBe(2);
  });
});
