import { describe, expect, it } from 'vitest';
import {
  eventHasPitchCoords,
  fifaEventToPitchPercent,
  PITCH_MARGIN_X,
  PITCH_SPAN_X,
} from './pitchCoordinates.js';

describe('pitchCoordinates', () => {
  it('fifaEventToPitchPercent mapea esquina superior izquierda', () => {
    const point = fifaEventToPitchPercent({ positionX: 0, positionY: 0 });
    expect(point).toEqual({
      left: `${PITCH_MARGIN_X}%`,
      top: '8%',
    });
  });

  it('fifaEventToPitchPercent mapea esquina inferior derecha', () => {
    const point = fifaEventToPitchPercent({ positionX: 100, positionY: 100 });
    expect(point?.left).toBe(`${PITCH_MARGIN_X + PITCH_SPAN_X}%`);
    expect(point?.top).toBe('92%');
  });

  it('eventHasPitchCoords rechaza eventos sin coords', () => {
    expect(eventHasPitchCoords({ positionX: null, positionY: 50 })).toBe(false);
    expect(eventHasPitchCoords({ positionX: 40, positionY: 55 })).toBe(true);
  });
});
