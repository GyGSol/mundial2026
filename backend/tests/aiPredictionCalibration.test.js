import { describe, it, expect } from 'vitest';
import {
  applyCalibrationNudge,
  buildCalibrationPromptBlock,
} from '../src/services/aiPredictionCalibrationService.js';

describe('aiPredictionCalibrationService', () => {
  it('buildCalibrationPromptBlock devuelve null sin historial', () => {
    expect(buildCalibrationPromptBlock({ partidosAnalizados: 0 })).toBeNull();
  });

  it('buildCalibrationPromptBlock resume sesgos', () => {
    const block = buildCalibrationPromptBlock({
      partidosAnalizados: 15,
      errorCombinado: 0.42,
      sesgoLocal: '+0.8 goles de error promedio',
      sesgoVisitante: '-0.1',
      nota: 'Tendés a errar de más en goles del local',
    });
    expect(block.partidosAnalizados).toBe(15);
    expect(block.errorCombinado).toBe(0.42);
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
});
