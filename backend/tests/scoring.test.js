import { describe, it, expect } from 'vitest';
import { calculatePoints, calculateGoalDiff } from '../src/services/scoringService.js';

describe('calculatePoints', () => {
  it('predicción 2-2 vs resultado 4-0: solo bonus volumen (+1)', () => {
    const result = calculatePoints({ home: 2, away: 2 }, { home: 4, away: 0 });
    expect(result.breakdown.winner).toBe(0);
    expect(result.breakdown.homeGoals).toBe(0);
    expect(result.breakdown.awayGoals).toBe(0);
    expect(result.breakdown.totalGoals).toBe(1);
    expect(result.total).toBe(1);
  });

  it('predicción 2-1 vs resultado 3-2: solo ganador (+3)', () => {
    const result = calculatePoints({ home: 2, away: 1 }, { home: 3, away: 2 });
    expect(result.breakdown.winner).toBe(3);
    expect(result.breakdown.homeGoals).toBe(0);
    expect(result.breakdown.awayGoals).toBe(0);
    expect(result.breakdown.totalGoals).toBe(0);
    expect(result.total).toBe(3);
  });

  it('predicción 1-0 vs resultado 1-0: máximo 6 puntos', () => {
    const result = calculatePoints({ home: 1, away: 0 }, { home: 1, away: 0 });
    expect(result.breakdown.winner).toBe(3);
    expect(result.breakdown.homeGoals).toBe(1);
    expect(result.breakdown.awayGoals).toBe(1);
    expect(result.breakdown.totalGoals).toBe(1);
    expect(result.total).toBe(6);
  });

  it('predicción 0-0 vs resultado 1-1: empate correcto (+3)', () => {
    const result = calculatePoints({ home: 0, away: 0 }, { home: 1, away: 1 });
    expect(result.breakdown.winner).toBe(3);
    expect(result.breakdown.homeGoals).toBe(0);
    expect(result.breakdown.awayGoals).toBe(0);
    expect(result.breakdown.totalGoals).toBe(0);
    expect(result.total).toBe(3);
  });

  it('predicción 3-0 vs resultado 2-1: ganador (+3) y volumen (+1)', () => {
    const result = calculatePoints({ home: 3, away: 0 }, { home: 2, away: 1 });
    expect(result.breakdown.winner).toBe(3);
    expect(result.breakdown.totalGoals).toBe(1);
    expect(result.total).toBe(4);
  });

  it('visitante gana: predicción 0-3 vs 1-3', () => {
    const result = calculatePoints({ home: 0, away: 3 }, { home: 1, away: 3 });
    expect(result.breakdown.winner).toBe(3);
    expect(result.breakdown.awayGoals).toBe(1);
    expect(result.total).toBe(4);
  });

  it('ganador incorrecto pero volumen acertado: +1', () => {
    const result = calculatePoints({ home: 2, away: 0 }, { home: 0, away: 2 });
    expect(result.breakdown.winner).toBe(0);
    expect(result.breakdown.totalGoals).toBe(1);
    expect(result.total).toBe(1);
  });
});

describe('calculateGoalDiff', () => {
  it('predicción 1-0 vs resultado 2-0: dif local 1, dif visitante 0', () => {
    const diff = calculateGoalDiff({ home: 1, away: 0 }, { home: 2, away: 0 });
    expect(diff.home).toBe(1);
    expect(diff.away).toBe(0);
  });

  it('usa valor absoluto cuando se predice por encima del resultado', () => {
    const diff = calculateGoalDiff({ home: 3, away: 2 }, { home: 1, away: 0 });
    expect(diff.home).toBe(2);
    expect(diff.away).toBe(2);
  });
});
