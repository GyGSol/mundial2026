import { describe, expect, it } from 'vitest';
import {
  formatPlayerEventLabel,
  inferTacticalPosition,
} from '../src/utils/playerPositionLabel.js';

describe('playerPositionLabel', () => {
  describe('inferTacticalPosition', () => {
    it('mapea portero', () => {
      expect(inferTacticalPosition({ position: 'GK' })).toBe('POR');
    });

    it('usa fallback coarse cuando no hay coordenadas', () => {
      expect(inferTacticalPosition({ position: 'DEF' })).toBe('DFC');
      expect(inferTacticalPosition({ position: 'MID' })).toBe('MD');
      expect(inferTacticalPosition({ position: 'FWD' })).toBe('DC');
    });

    it('infiere lateral derecho desde coordenadas', () => {
      expect(
        inferTacticalPosition({ position: 'DEF', positionX: 20, positionY: 85 })
      ).toBe('LD');
    });

    it('infiere medio centro desde coordenadas centrales', () => {
      expect(
        inferTacticalPosition({ position: 'MID', positionX: 50, positionY: 50 })
      ).toBe('MD');
    });
  });

  describe('formatPlayerEventLabel', () => {
    it('incluye abreviatura y dorsal', () => {
      expect(
        formatPlayerEventLabel({
          name: 'Juan José Caceres',
          position: 'DEF',
          positionX: 20,
          positionY: 85,
          shirtNumber: 4,
        })
      ).toBe('LD 4 · Juan José Caceres');
    });

    it('sin dorsal muestra solo posición', () => {
      expect(
        formatPlayerEventLabel({
          name: 'Pulisic',
          position: 'MID',
        })
      ).toBe('MD · Pulisic');
    });
  });
});
