import { describe, it, expect } from 'vitest';
import {
  applyFormationGridOverridesToLineup,
  formationOverrideKey,
  normalizeFormationOverrideMap,
  readFormationGridOverridesFromMatch,
} from '../src/services/formationGridOverrideService.js';

describe('formationGridOverrideService', () => {
  it('formationOverrideKey usa side y dorsal', () => {
    expect(formationOverrideKey('home', 16, 'Dahmen')).toBe('home:16');
    expect(formationOverrideKey('away', null, 'Depay')).toBe('away:Depay');
  });

  it('normaliza y filtra overrides inválidos', () => {
    const players = normalizeFormationOverrideMap({
      'home:10': { gridX: 55.5, gridY: 40, name: 'Depay' },
      bad: { gridX: 1, gridY: 2 },
      'away:1': { gridX: 'x', gridY: 10 },
    });
    expect(players).toEqual({
      'home:10': { gridX: 55.5, gridY: 40, name: 'Depay' },
    });
  });

  it('aplica overrides sobre lineup enriquecido', () => {
    const lineup = {
      status: 'confirmed',
      home: {
        formation: '4-3-3',
        players: [
          { name: 'A', shirtNumber: 1, gridX: 10, gridY: 50 },
          { name: 'B', shirtNumber: 9, gridX: 70, gridY: 50 },
        ],
      },
      away: { formation: '4-4-2', players: [] },
    };
    const match = {
      raw: {
        formationGridOverrides: {
          players: {
            'home:9': { gridX: 80, gridY: 30 },
          },
        },
      },
    };

    const patched = applyFormationGridOverridesToLineup(lineup, match);
    expect(patched.formationOverridesApplied).toBe(true);
    expect(patched.home.players[0].gridX).toBe(10);
    expect(patched.home.players[1].gridX).toBe(80);
    expect(patched.home.players[1].gridY).toBe(30);
  });

  it('readFormationGridOverridesFromMatch devuelve vacío si no hay datos', () => {
    expect(readFormationGridOverridesFromMatch({ raw: {} }).players).toEqual({});
  });
});
