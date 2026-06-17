import { describe, it, expect } from 'vitest';
import { aggregateMatchPredictions } from '../src/services/aiCrowdPredictionContextService.js';

describe('aiCrowdPredictionContextService', () => {
  it('agrega mediana y modo de resultado', () => {
    const agg = aggregateMatchPredictions([
      { homeGoals: 2, awayGoals: 1 },
      { homeGoals: 1, awayGoals: 1 },
      { homeGoals: 2, awayGoals: 0 },
    ]);

    expect(agg.muestras).toBe(3);
    expect(agg.mediana.local).toBe(2);
    expect(agg.mediana.visitante).toBe(1);
    expect(agg.resultadoFrecuente).toBe('victoria local');
    expect(agg.porcentajeResultadoFrecuente).toBeGreaterThanOrEqual(33);
  });

  it('maneja muestra vacía', () => {
    const agg = aggregateMatchPredictions([]);
    expect(agg.muestras).toBe(0);
    expect(agg.mediana.local).toBeNull();
  });
});
