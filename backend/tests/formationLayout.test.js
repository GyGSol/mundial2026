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
    const gk = parseApiFootballGrid('1:1', '4-3-3');
    const def = parseApiFootballGrid('2:2', '4-3-3');
    const fwd = parseApiFootballGrid('4:2', '4-3-3');
    expect(gk).not.toBeNull();
    expect(gk.gridX).toBe(3);
    expect(def.gridX).toBeGreaterThan(30);
    expect(def.gridX).toBeLessThan(50);
    expect(fwd.gridX).toBeGreaterThan(85);
  });

  it('assignFormationGrid devuelve 11 slots para 4-3-3', () => {
    const slots = assignFormationGrid('4-3-3', 11);
    expect(slots).toHaveLength(11);
    expect(slots[0].gridX).toBe(3);
    expect(slots[5].gridX).toBe(72);
    expect(slots[10].gridX).toBe(97);
  });

  it('prioriza positionDetail sobre position cacheado incorrecto', () => {
    const players = [
      { name: 'Adams', position: 'DEF', positionDetail: 'Defensive Midfield', shirtNumber: 6 },
      { name: 'Pulisic', position: 'MID', positionDetail: 'Left Winger', shirtNumber: 10 },
    ];
    const assigned = assignPlayersToFormation(players, '4-3-3');
    expect(assigned.find((p) => p.name === 'Adams').gridX).toBe(68);
    expect(assigned.find((p) => p.name === 'Pulisic').gridX).toBe(97);
  });

  it('assignPlayersToFormation separa DEF, MID y FWD en tres profundidades', () => {
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
    const depths = [...new Set(assigned.map((p) => p.gridX))].sort((a, b) => a - b);

    expect(depths.length).toBeGreaterThanOrEqual(4);
    expect(assigned.find((p) => p.name === 'GK').gridX).toBeLessThan(
      assigned.find((p) => p.name === 'LD').gridX
    );
    expect(assigned.find((p) => p.name === 'LD').gridX).toBeLessThan(
      assigned.find((p) => p.name === 'MID2').gridX
    );
    expect(assigned.find((p) => p.name === 'MID2').gridX).toBeLessThan(
      assigned.find((p) => p.name === 'ST').gridX
    );
    expect(assigned.filter((p) => p.gridX === 48)).toHaveLength(4);
  });

  it('mapFootballDataPositionText no clasifica pivote como defensa', () => {
    expect(mapFootballDataPositionText('Defensive Midfield')).toBe('MID');
    expect(mapFootballDataPositionText('Left Wing')).toBe('FWD');
    expect(mapFootballDataPositionText('Right Wing')).toBe('FWD');
  });

  it('mergePlayerGrids ignora gridRaw para profundidad y usa formación', () => {
    const players = [
      { name: 'A', position: 'GK', gridRaw: '1:1' },
      { name: 'B', position: 'DEF', gridRaw: '2:2' },
      { name: 'C', position: 'FWD', gridRaw: '2:3' },
    ];
    const merged = mergePlayerGrids(players, '4-3-3');
    expect(merged[0].gridX).toBe(3);
    expect(merged[1].gridX).toBe(48);
    expect(merged[2].gridX).toBe(97);
    expect(merged[0].gridRaw).toBeUndefined();
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
