import { describe, it, expect } from 'vitest';
import {
  mapFifaPositionCode,
  buildLineupSideFromFifaTeam,
  buildFifaLineupSides,
} from '../src/services/fifaLineupService.js';

function mkPlayer({ shirt, status = 1, position = 2, name, id = shirt }) {
  return {
    IdPlayer: String(id),
    ShirtNumber: shirt,
    Status: status,
    Position: position,
    PlayerName: [{ Locale: 'en-GB', Description: name }],
  };
}

describe('fifaLineupService', () => {
  it('mapFifaPositionCode mapea códigos FIFA', () => {
    expect(mapFifaPositionCode(0)).toBe('GK');
    expect(mapFifaPositionCode(1)).toBe('DEF');
    expect(mapFifaPositionCode(2)).toBe('MID');
    expect(mapFifaPositionCode(3)).toBe('FWD');
  });

  it('buildLineupSideFromFifaTeam extrae XI y formación Tactics', () => {
    const side = buildLineupSideFromFifaTeam({
      Tactics: '3-5-2',
      Coaches: [{ Name: [{ Locale: 'en-GB', Description: 'Coach Test' }] }],
      Players: [
        mkPlayer({ shirt: 1, position: 0, name: 'GK Player' }),
        ...Array.from({ length: 10 }, (_, i) =>
          mkPlayer({ shirt: i + 2, position: i < 3 ? 1 : i < 8 ? 2 : 3, name: `P${i + 2}` })
        ),
      ],
    });

    expect(side.formation).toBe('3-5-2');
    expect(side.coach).toBe('Coach Test');
    expect(side.players).toHaveLength(11);
    expect(side.players[0].name).toBe('GK Player');
    expect(side.players[0].position).toBe('GK');
  });

  it('buildFifaLineupSides ignora equipos sin XI completo', () => {
    const sides = buildFifaLineupSides({
      HomeTeam: {
        Tactics: '4-3-3',
        Players: [mkPlayer({ shirt: 1, position: 0, name: 'GK' })],
      },
      AwayTeam: null,
    });
    expect(sides.home).toBeNull();
    expect(sides.away).toBeNull();
  });
});
