import { describe, it, expect } from 'vitest';
import {
  parseFormationString,
  parseApiFootballGrid,
  assignFormationGrid,
  mergePlayerGrids,
  mapFootballDataPositionText,
} from '../src/utils/formationLayout.js';

describe('formationLayout', () => {
  it('parseFormationString agrega portero', () => {
    expect(parseFormationString('4-3-3')).toEqual([1, 4, 3, 3]);
    expect(parseFormationString('3-4-1-2')).toEqual([1, 3, 4, 1, 2]);
  });

  it('parseApiFootballGrid normaliza row:col', () => {
    const coords = parseApiFootballGrid('2:3');
    expect(coords).not.toBeNull();
    expect(coords.gridX).toBeGreaterThanOrEqual(0);
    expect(coords.gridY).toBeGreaterThanOrEqual(0);
  });

  it('assignFormationGrid devuelve 11 slots para 4-3-3', () => {
    const slots = assignFormationGrid('4-3-3', 11);
    expect(slots).toHaveLength(11);
    expect(slots[0].gridX).toBe(10);
    expect(slots[10].gridX).toBe(90);
  });

  it('mergePlayerGrids usa gridRaw cuando existe', () => {
    const players = [
      { name: 'A', gridRaw: '1:1' },
      { name: 'B' },
    ];
    const merged = mergePlayerGrids(players, '4-3-3');
    expect(merged[0].gridX).toBeDefined();
    expect(merged[0].gridRaw).toBeUndefined();
    expect(merged[1].gridX).toBeDefined();
  });

  it('mapFootballDataPositionText mapea roles FD', () => {
    expect(mapFootballDataPositionText('Goalkeeper')).toBe('GK');
    expect(mapFootballDataPositionText('Centre-Back')).toBe('DEF');
    expect(mapFootballDataPositionText('Central Midfield')).toBe('MID');
    expect(mapFootballDataPositionText('Centre-Forward')).toBe('FWD');
  });
});
