import { describe, expect, it } from 'vitest';
import {
  eventHasPitchCoords,
  fifaEventToPitchPercent,
  getPitchEventFifaCoords,
  isInAttackingThird,
  lineupGridToHalfPitchPercent,
  LINEUP_LATERAL_EDGE,
  LINEUP_LATERAL_SPAN,
  PITCH_MARGIN_X,
  PITCH_SPAN_X,
} from './pitchCoordinates.js';

function lateralTopPercent(gridY, side) {
  return lineupGridToHalfPitchPercent(50, gridY, side).top;
}

describe('pitchCoordinates', () => {
  describe('lineupGridToHalfPitchPercent', () => {
    it('local: LI arriba y LD abajo', () => {
      const liTop = Number.parseFloat(lateralTopPercent(4, 'home'));
      const ldTop = Number.parseFloat(lateralTopPercent(96, 'home'));
      expect(liTop).toBeLessThan(ldTop);
      expect(liTop).toBeCloseTo(LINEUP_LATERAL_EDGE + (4 / 100) * LINEUP_LATERAL_SPAN, 1);
      expect(ldTop).toBeCloseTo(LINEUP_LATERAL_EDGE + (96 / 100) * LINEUP_LATERAL_SPAN, 1);
    });

    it('visitante: espeja lateral (LD arriba, LI abajo)', () => {
      const liTop = Number.parseFloat(lateralTopPercent(4, 'away'));
      const ldTop = Number.parseFloat(lateralTopPercent(96, 'away'));
      expect(ldTop).toBeLessThan(liTop);
      expect(liTop).toBeCloseTo(LINEUP_LATERAL_EDGE + (96 / 100) * LINEUP_LATERAL_SPAN, 1);
      expect(ldTop).toBeCloseTo(LINEUP_LATERAL_EDGE + (4 / 100) * LINEUP_LATERAL_SPAN, 1);
    });

    it('espeja profundidad del visitante hacia el centro', () => {
      const home = lineupGridToHalfPitchPercent(85, 50, 'home');
      const away = lineupGridToHalfPitchPercent(85, 50, 'away');
      expect(home.left).not.toBe(away.left);
      expect(Number.parseFloat(home.left)).toBeGreaterThan(Number.parseFloat(away.left));
    });
  });

  it('fifaEventToPitchPercent mapea esquina superior izquierda', () => {
    const point = fifaEventToPitchPercent({ type: 'foul', positionX: 0, positionY: 0 });
    expect(point).toEqual({
      left: `${PITCH_MARGIN_X}%`,
      top: '8%',
    });
  });

  it('fifaEventToPitchPercent mapea esquina inferior derecha', () => {
    const point = fifaEventToPitchPercent({ type: 'foul', positionX: 100, positionY: 100 });
    expect(point?.left).toBe(`${PITCH_MARGIN_X + PITCH_SPAN_X}%`);
    expect(point?.top).toBe('92%');
  });

  it('eventHasPitchCoords rechaza eventos sin coords', () => {
    expect(eventHasPitchCoords({ positionX: null, positionY: 50 })).toBe(false);
    expect(eventHasPitchCoords({ positionX: 40, positionY: 55 })).toBe(true);
  });

  it('coloca tiros del local hacia la derecha de la cancha', () => {
    expect(
      getPitchEventFifaCoords({
        type: 'shot_attempt',
        side: 'home',
        positionX: 12,
        positionY: 50,
      })
    ).toEqual({ x: 88, y: 50 });
  });

  it('coloca tiros del visitante hacia la izquierda de la cancha', () => {
    expect(
      getPitchEventFifaCoords({
        type: 'shot_attempt',
        side: 'away',
        positionX: 98,
        positionY: 48,
      })
    ).toEqual({ x: 2, y: 52 });
  });

  it('coloca gol del local en la derecha aunque sea 2.º tiempo', () => {
    expect(
      getPitchEventFifaCoords({
        type: 'goal',
        side: 'home',
        minute: 78,
        positionX: 86,
        positionY: 51,
      })
    ).toEqual({ x: 86, y: 51 });
  });

  it('coloca gol del visitante en la izquierda', () => {
    expect(
      getPitchEventFifaCoords({
        type: 'goal',
        side: 'away',
        minute: 21,
        positionX: 98,
        positionY: 50,
      })
    ).toEqual({ x: 2, y: 50 });
  });

  it('conserva posición absoluta de faltas (no orientación de ataque)', () => {
    expect(
      getPitchEventFifaCoords({
        type: 'foul',
        side: 'home',
        positionX: 25,
        positionY: 40,
      })
    ).toEqual({ x: 25, y: 40 });

    expect(
      getPitchEventFifaCoords({
        type: 'foul',
        side: 'home',
        positionX: 88,
        positionY: 40,
      })
    ).toEqual({ x: 88, y: 40 });

    expect(
      getPitchEventFifaCoords({
        type: 'yellow_card',
        side: 'away',
        positionX: 30,
        positionY: 50,
      })
    ).toEqual({ x: 30, y: 50 });
  });

  it('isInAttackingThird delimita zona ofensiva por equipo', () => {
    expect(isInAttackingThird('home', 70)).toBe(true);
    expect(isInAttackingThird('home', 30)).toBe(false);
    expect(isInAttackingThird('away', 30)).toBe(true);
    expect(isInAttackingThird('away', 70)).toBe(false);
  });

  it('deja coords sin transformar para sustituciones', () => {
    expect(
      getPitchEventFifaCoords({
        type: 'substitution',
        side: 'home',
        positionX: 20,
        positionY: 40,
      })
    ).toEqual({ x: 20, y: 40 });
  });
});
