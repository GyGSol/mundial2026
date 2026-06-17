import { describe, it, expect } from 'vitest';
import {
  buildPostMatchReviewPrompt,
  formatPostMatchReviewRowMeta,
  matchResultScoreKey,
} from '../src/services/aiPostMatchLearningService.js';

describe('aiPostMatchLearningService', () => {
  const match = {
    externalId: '23',
    group: 'K',
    homeTeamId: 'POR',
    awayTeamId: 'COD',
    status: 'finished',
    homeScore: 1,
    awayScore: 0,
  };

  const prediction = {
    homeGoals: 1,
    awayGoals: 0,
    pointsEarned: 6,
    goalDiffHome: 0,
    goalDiffAway: 0,
    pointsBreakdown: { winner: 1, homeGoals: 1, awayGoals: 1, totalGoals: 1 },
    predictionSource: 'ai',
    aiReasoning: 'Portugal favorito por ranking.',
    aiCalibrationApplied: false,
    aiPostMatchReview: {
      analysis: '### Resumen\nMarcador exacto.',
      generatedAt: new Date('2026-06-17T18:00:00Z'),
      resultScoreKey: '1-0',
    },
  };

  it('matchResultScoreKey formatea marcador', () => {
    expect(matchResultScoreKey(match)).toBe('1-0');
    expect(matchResultScoreKey({ homeScore: null, awayScore: 0 })).toBeNull();
  });

  it('formatPostMatchReviewRowMeta marca disponible en finalizados puntuados', () => {
    const meta = formatPostMatchReviewRowMeta(match, prediction);
    expect(meta.available).toBe(true);
    expect(meta.generated).toBe(true);
    expect(meta.preview).toContain('Resumen');
  });

  it('formatPostMatchReviewRowMeta detecta análisis obsoleto si cambia el resultado', () => {
    const meta = formatPostMatchReviewRowMeta({ ...match, homeScore: 2 }, prediction);
    expect(meta.stale).toBe(true);
    expect(meta.generated).toBe(false);
  });

  it('buildPostMatchReviewPrompt incluye predicción, resultado, humanos y razonamiento', () => {
    const prompt = buildPostMatchReviewPrompt({
      match,
      prediction,
      promptContext: { equipoLocal: 'Portugal' },
      calibrationStats: { partidosAnalizados: 5, errorCombinado: 0.12 },
      humanConsensus: {
        muestras: 12,
        mediana: { local: 1, visitante: 0 },
        resultadoFrecuente: 'victoria local',
        porcentajeResultadoFrecuente: 58,
        dispersion: { local: 0.4, visitante: 0.3 },
      },
      vsHumans: { aiScore: { home: 1, away: 0 } },
    });
    expect(prompt).toContain('1-0');
    expect(prompt).toContain('Portugal favorito');
    expect(prompt).toContain('Lecciones para bajar Gdif');
    expect(prompt).toContain('Predicciones de otros jugadores');
    expect(prompt).toContain('Mediana humana');
  });
});
