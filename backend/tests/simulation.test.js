import { describe, it, expect } from 'vitest';
import { buildPairings, randomScore } from '../src/services/simulationService.helpers.js';

describe('simulationService helpers', () => {
  it('genera puntajes entre 0 y 4', () => {
    for (let i = 0; i < 30; i += 1) {
      const score = randomScore();
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(4);
    }
  });

  it('arma partidos sin repetir local y visitante', () => {
    const teams = [
      { externalId: '1', nameEn: 'A' },
      { externalId: '2', nameEn: 'B' },
      { externalId: '3', nameEn: 'C' },
      { externalId: '4', nameEn: 'D' },
    ];

    const pairings = buildPairings(teams, 6);
    expect(pairings).toHaveLength(6);
    for (const pairing of pairings) {
      expect(pairing.home.externalId).not.toBe(pairing.away.externalId);
    }
  });

  it('falla si no hay equipos suficientes', () => {
    expect(() => buildPairings([{ externalId: '1' }], 3)).toThrow(
      'Se necesitan al menos 2 equipos'
    );
  });
});
