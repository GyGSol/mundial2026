import { describe, it, expect } from 'vitest';
import {
  applyCalibrationNudge,
  buildCalibrationHintFromReview,
  buildCalibrationPromptBlock,
  computeObservedGoalBias,
  parseCalibrationHintFromText,
} from '../src/services/aiPredictionCalibrationService.js';

describe('aiPredictionCalibrationService', () => {
  it('buildCalibrationPromptBlock devuelve null sin historial', () => {
    expect(buildCalibrationPromptBlock({ partidosAnalizados: 0 })).toBeNull();
  });

  it('buildCalibrationPromptBlock resume sesgos y referencias', () => {
    const block = buildCalibrationPromptBlock({
      partidosAnalizados: 15,
      errorCombinado: 0.42,
      sesgoLocal: '+0.8 goles de error promedio',
      sesgoVisitante: '-0.1',
      nota: 'Tendés a errar de más en goles del local',
      postMatchHints: { partidos: 6, avgBiasHome: 0.5, avgBiasAway: 0.2 },
      humanReference: {
        partidosConHumanos: 10,
        aiVsHumanMedianHome: 0.4,
        aiVsHumanMedianAway: -0.1,
      },
    });
    expect(block.partidosAnalizados).toBe(15);
    expect(block.ajustesPostPartido.partidos).toBe(6);
    expect(block.referenciaHumanos.partidos).toBe(10);
  });

  it('applyCalibrationNudge no ajusta con pocas muestras', () => {
    const score = { homeGoals: 2, awayGoals: 1, reasoning: 'test', source: 'heuristic' };
    const out = applyCalibrationNudge(score, { puedeAjustar: false });
    expect(out.homeGoals).toBe(2);
    expect(out.calibrationApplied).toBe(false);
  });

  it('applyCalibrationNudge reduce goles con sesgo positivo alto', () => {
    const score = { homeGoals: 3, awayGoals: 2, reasoning: 'test', source: 'heuristic' };
    const out = applyCalibrationNudge(score, {
      puedeAjustar: true,
      avgErrorHome: 0.8,
      avgErrorAway: 0.8,
    });
    expect(out.homeGoals).toBe(2);
    expect(out.awayGoals).toBe(1);
    expect(out.calibrationApplied).toBe(true);
  });

  it('applyCalibrationNudge usa umbral más bajo con informes post-partido', () => {
    const score = { homeGoals: 2, awayGoals: 1, reasoning: 'test', source: 'heuristic' };
    const out = applyCalibrationNudge(score, {
      puedeAjustar: true,
      avgErrorHome: 0.45,
      avgErrorAway: 0,
      postMatchHints: { partidos: 5, avgBiasHome: 0.5, avgBiasAway: 0 },
    });
    expect(out.homeGoals).toBe(1);
    expect(out.calibrationApplied).toBe(true);
  });

  it('computeObservedGoalBias calcula sobre/subestimación', () => {
    expect(
      computeObservedGoalBias({ homeGoals: 2, awayGoals: 1 }, { homeScore: 1, awayScore: 0 })
    ).toEqual({ biasHome: 1, biasAway: 1 });
    expect(
      computeObservedGoalBias({ homeGoals: 0, awayGoals: 0 }, { homeScore: 1, awayScore: 1 })
    ).toEqual({ biasHome: -1, biasAway: -1 });
  });

  it('parseCalibrationHintFromText detecta sobreestimación local', () => {
    const text = `### Ajuste sugerido de calibración
Sobreestimaste los goles del local en ~0.5 goles; alineá con la calibración rolling.`;
    const hint = parseCalibrationHintFromText(text);
    expect(hint.biasHome).toBeGreaterThan(0);
  });

  it('buildCalibrationHintFromReview combina observado y texto', () => {
    const hint = buildCalibrationHintFromReview(
      { homeGoals: 2, awayGoals: 1 },
      { homeScore: 1, awayScore: 0 },
      `### Ajuste sugerido de calibración\nSubestimaste goles del visitante.`
    );
    expect(hint.observedBiasHome).toBe(1);
    expect(hint.observedBiasAway).toBe(1);
    expect(hint.biasHome).toBeGreaterThan(0);
  });
});
