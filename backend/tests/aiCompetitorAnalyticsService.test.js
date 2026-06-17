import { describe, it, expect } from 'vitest';
import {
  buildMseHistogram,
  buildErrorCurvePoints,
  buildErrorCurveSummary,
  buildRollingBiasSeries,
  rollingHitRates,
  matchPhase,
} from '../src/services/aiCompetitorAnalyticsService.js';

describe('aiCompetitorAnalyticsService helpers', () => {
  it('buildMseHistogram agrupa errores en buckets', () => {
    const hist = buildMseHistogram([0, 1, 4, 8, 15, 25]);
    const byLabel = Object.fromEntries(hist.map((h) => [h.bucket, h.count]));
    expect(byLabel['0']).toBe(1);
    expect(byLabel['0-2']).toBe(1);
    expect(byLabel['2-5']).toBe(1);
    expect(byLabel['5-10']).toBe(1);
    expect(byLabel['10-20']).toBe(1);
    expect(byLabel['20+']).toBe(1);
  });

  it('buildErrorCurvePoints acumula MSE en orden', () => {
    const rows = [
      { matchId: 'a', externalId: '1', kickoffAt: null, label: 'A', group: 'A', mse: 4, gdif: 0.1, predictedScore: [1, 0], actualScore: [0, 0] },
      { matchId: 'b', externalId: '2', kickoffAt: null, label: 'B', group: 'A', mse: 0, gdif: 0, predictedScore: [2, 1], actualScore: [2, 1] },
    ];
    const points = buildErrorCurvePoints(rows);
    expect(points).toHaveLength(2);
    expect(points[0].cumulativeAvgMse).toBe(4);
    expect(points[1].cumulativeAvgMse).toBe(2);
  });

  it('buildErrorCurveSummary detecta tendencia', () => {
    const improving = buildErrorCurveSummary([
      { mseError: 10, cumulativeAvgMse: 10, gdifCombined: 0.5 },
      { mseError: 2, cumulativeAvgMse: 6, gdifCombined: 0.3 },
    ]);
    expect(improving.tendencia).toBe('mejorando');

    const worsening = buildErrorCurveSummary([
      { mseError: 2, cumulativeAvgMse: 2, gdifCombined: 0.1 },
      { mseError: 10, cumulativeAvgMse: 6, gdifCombined: 0.4 },
    ]);
    expect(worsening.tendencia).toBe('empeorando');
  });

  it('rollingHitRates calcula porcentajes en ventana', () => {
    const rows = [
      { externalId: '1', paHit: true, glHit: false, gvHit: false, gtHit: false },
      { externalId: '2', paHit: true, glHit: true, gvHit: false, gtHit: false },
      { externalId: '3', paHit: false, glHit: false, gvHit: true, gtHit: false },
    ];
    const rolling = rollingHitRates(rows, 2);
    expect(rolling[2].paPct).toBe(50);
    expect(rolling[2].glPct).toBe(50);
    expect(rolling[2].gvPct).toBe(50);
  });

  it('buildRollingBiasSeries promedia sesgos acumulados', () => {
    const series = buildRollingBiasSeries([
      { externalId: '1', biasHome: 2, biasAway: 0 },
      { externalId: '2', biasHome: 0, biasAway: 2 },
    ]);
    expect(series[1].avgBiasHome).toBe(1);
    expect(series[1].avgBiasAway).toBe(1);
  });

  it('matchPhase distingue fase de grupos y eliminatoria', () => {
    expect(matchPhase({ type: 'group' })).toBe('group');
    expect(matchPhase({ type: 'round16' })).toBe('knockout');
  });
});
