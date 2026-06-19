import { describe, it, expect } from 'vitest';
import {
  parseFormationString,
  parseApiFootballGrid,
  assignFormationGrid,
  assignPlayersToFormation,
  mergePlayerGrids,
  lateralSortKey,
  mapFootballDataPositionText,
} from '../src/utils/formationLayout.js';

describe('formationLayout', () => {
  it('parseFormationString agrega portero', () => {
    expect(parseFormationString('4-3-3')).toEqual([1, 4, 3, 3]);
    expect(parseFormationString('3-4-1-2')).toEqual([1, 3, 4, 1, 2]);
  });

  it('parseApiFootballGrid normaliza row:col según formación', () => {
    const coords = parseApiFootballGrid('2:3', '4-3-3');
    expect(coords).not.toBeNull();
    expect(coords.gridX).toBe(30);
    expect(coords.gridY).toBe(65);
  });

  it('assignFormationGrid devuelve 11 slots para 4-3-3', () => {
    const slots = assignFormationGrid('4-3-3', 11);
    expect(slots).toHaveLength(11);
    expect(slots[0].gridX).toBe(12);
    expect(slots[10].gridX).toBe(80);
  });

  it('assignPlayersToFormation coloca líneas tácticas GK→DEF→MID→FWD', () => {
    const players = [
      { name: 'GK', position: 'GK', shirtNumber: 1 },
      { name: 'LD', position: 'DEF', positionDetail: 'Left-Back', shirtNumber: 3 },
      { name: 'CD', position: 'DEF', positionDetail: 'Centre-Back', shirtNumber: 4 },
      { name: 'CD2', position: 'DEF', positionDetail: 'Centre-Back', shirtNumber: 5 },
      { name: 'RD', position: 'DEF', positionDetail: 'Right-Back', shirtNumber: 2 },
      { name: 'MID1', position: 'MID', positionDetail: 'Defensive Midfield', shirtNumber: 6 },
      { name: 'MID2', position: 'MID', shirtNumber: 8 },
      { name: 'MID3', position: 'MID', positionDetail: 'Attacking Midfield', shirtNumber: 10 },
      { name: 'LW', position: 'FWD', positionDetail: 'Left Winger', shirtNumber: 11 },
      { name: 'ST', position: 'FWD', positionDetail: 'Centre-Forward', shirtNumber: 9 },
      { name: 'RW', position: 'FWD', positionDetail: 'Right Winger', shirtNumber: 7 },
    ];
    const assigned = assignPlayersToFormation(players, '4-3-3');
    const gk = assigned.find((p) => p.name === 'GK');
    const st = assigned.find((p) => p.name === 'ST');
    const ld = assigned.find((p) => p.name === 'LD');
    const rd = assigned.find((p) => p.name === 'RD');

    expect(gk.gridX).toBeLessThan(st.gridX);
    expect(ld.gridY).toBeLessThan(rd.gridY);
    expect(assigned.filter((p) => p.gridX === 30)).toHaveLength(4);
  });

  it('mergePlayerGrids usa gridRaw cuando existe', () => {
    const players = [
      { name: 'A', position: 'GK', gridRaw: '1:1' },
      { name: 'B', position: 'DEF' },
    ];
    const merged = mergePlayerGrids(players, '4-3-3');
    expect(merged[0].gridX).toBe(12);
    expect(merged[0].gridRaw).toBeUndefined();
    expect(merged[1].gridX).toBeDefined();
  });

  it('lateralSortKey ordena laterales izq→der', () => {
    expect(lateralSortKey({ positionDetail: 'Left-Back' })).toBeLessThan(
      lateralSortKey({ positionDetail: 'Right-Back' })
    );
  });

  it('mapFootballDataPositionText mapea roles FD', () => {
    expect(mapFootballDataPositionText('Goalkeeper')).toBe('GK');
    expect(mapFootballDataPositionText('Centre-Back')).toBe('DEF');
    expect(mapFootballDataPositionText('Central Midfield')).toBe('MID');
    expect(mapFootballDataPositionText('Centre-Forward')).toBe('FWD');
  });
});
