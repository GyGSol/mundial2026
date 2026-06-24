import { describe, it, expect } from 'vitest';
import {
  parseFormationString,
  parseApiFootballGrid,
  assignFormationGrid,
  assignPlayersToFormation,
  attackingMidPromotionScore,
  assignPlayersWithFormationLayout,
  inferFormationFromGridRows,
  inferFormationFromPositionPools,
  resolveFormation,
  mergePlayerGrids,
  lateralSortKey,
  mapFootballDataPositionText,
} from '../src/utils/formationLayout.js';

describe('formationLayout', () => {
  it('parseFormationString agrega portero', () => {
    expect(parseFormationString('4-3-3')).toEqual([1, 4, 3, 3]);
    expect(parseFormationString('3-4-1-2')).toEqual([1, 3, 4, 1, 2]);
    expect(parseFormationString('3-1-4-2')).toEqual([1, 3, 1, 4, 2]);
  });

  it('inferFormationFromGridRows deduce 3-1-4-2 y 5-4-1', () => {
    const ecuador = [
      { gridRaw: '1:1' },
      { gridRaw: '2:1' },
      { gridRaw: '2:2' },
      { gridRaw: '2:3' },
      { gridRaw: '3:2' },
      { gridRaw: '4:1' },
      { gridRaw: '4:2' },
      { gridRaw: '4:3' },
      { gridRaw: '4:4' },
      { gridRaw: '5:1' },
      { gridRaw: '5:2' },
    ];
    const curacao = [
      { gridRaw: '1:1' },
      ...Array.from({ length: 5 }, (_, i) => ({ gridRaw: `2:${i + 1}` })),
      ...Array.from({ length: 4 }, (_, i) => ({ gridRaw: `3:${i + 1}` })),
      { gridRaw: '4:2' },
    ];

    expect(inferFormationFromGridRows(ecuador)).toBe('3-1-4-2');
    expect(inferFormationFromGridRows(curacao)).toBe('5-4-1');
  });

  it('resolveFormation prefiere grid sobre 4-3-3 por defecto', () => {
    const players = [
      { gridRaw: '1:1', position: 'GK' },
      { gridRaw: '2:1', position: 'DEF' },
      { gridRaw: '2:2', position: 'DEF' },
      { gridRaw: '2:3', position: 'DEF' },
      { gridRaw: '3:2', position: 'MID' },
      { gridRaw: '4:1', position: 'MID' },
      { gridRaw: '4:2', position: 'MID' },
      { gridRaw: '4:3', position: 'MID' },
      { gridRaw: '4:4', position: 'MID' },
      { gridRaw: '5:1', position: 'FWD' },
      { gridRaw: '5:2', position: 'FWD' },
    ];

    expect(resolveFormation(players, '4-3-3')).toBe('3-1-4-2');
    expect(resolveFormation(players, '3-1-4-2')).toBe('3-1-4-2');
  });

  it('inferFormationFromPositionPools deduce 5-4-1', () => {
    const players = [
      { position: 'GK' },
      ...Array.from({ length: 5 }, () => ({ position: 'DEF' })),
      ...Array.from({ length: 4 }, () => ({ position: 'MID' })),
      { position: 'FWD' },
    ];
    expect(inferFormationFromPositionPools(players)).toBe('5-4-1');
  });

  it('assignPlayersWithFormationLayout usa profundidad del grid API con XI completo', () => {
    const players = [
      { name: 'GK', position: 'GK', gridRaw: '1:1', shirtNumber: 1 },
      { name: 'LB', position: 'DEF', gridRaw: '2:1', shirtNumber: 2 },
      { name: 'CB1', position: 'DEF', gridRaw: '2:2', shirtNumber: 3 },
      { name: 'CB2', position: 'DEF', gridRaw: '2:3', shirtNumber: 4 },
      { name: 'RB', position: 'DEF', gridRaw: '2:4', shirtNumber: 5 },
      { name: 'DM', position: 'MID', gridRaw: '3:2', shirtNumber: 6 },
      { name: 'LM', position: 'MID', gridRaw: '4:1', shirtNumber: 7 },
      { name: 'CM', position: 'MID', gridRaw: '4:2', shirtNumber: 8 },
      { name: 'RM', position: 'MID', gridRaw: '4:3', shirtNumber: 9 },
      { name: 'AM', position: 'MID', gridRaw: '4:4', shirtNumber: 10 },
      { name: 'ST', position: 'FWD', gridRaw: '5:2', shirtNumber: 11 },
    ];
    const placed = assignPlayersWithFormationLayout(players, '3-1-4-2');
    expect(placed.find((p) => p.name === 'GK').gridX).toBe(6);
    expect(placed.find((p) => p.name === 'ST').gridX).toBeGreaterThan(75);
    expect(placed).toHaveLength(11);
  });

  it('assignPlayersToFormation separa dos CF en 4-4-2 (cuadrícula)', () => {
    const players = [
      { shirtNumber: 1, position: 'GK', positionDetail: 'Goalkeeper' },
      { shirtNumber: 2, position: 'DEF', positionDetail: 'Left Back' },
      { shirtNumber: 3, position: 'DEF', positionDetail: 'Centre-Back' },
      { shirtNumber: 4, position: 'DEF', positionDetail: 'Centre-Back' },
      { shirtNumber: 5, position: 'DEF', positionDetail: 'Right Back' },
      { shirtNumber: 6, position: 'MID', positionDetail: 'Left Midfield' },
      { shirtNumber: 7, position: 'MID', positionDetail: 'Central Midfield' },
      { shirtNumber: 8, position: 'MID', positionDetail: 'Central Midfield' },
      { shirtNumber: 11, position: 'MID', positionDetail: 'Right Midfield' },
      { shirtNumber: 9, position: 'FW', positionDetail: 'Centre-Forward', gridRaw: '4:2' },
      { shirtNumber: 17, position: 'FW', positionDetail: 'Centre-Forward', gridRaw: '4:2' },
    ];

    const laidOut = assignPlayersToFormation(players, '4-4-2');
    const cfs = laidOut.filter((p) => p.pitchGridRole === 'DC');
    expect(cfs).toHaveLength(2);
    expect(Math.abs(cfs[0].gridY - cfs[1].gridY)).toBeGreaterThanOrEqual(20);
    expect(new Set(cfs.map((p) => p.pitchGridCellId)).size).toBe(2);
  });

  it('parseApiFootballGrid normaliza row:col según formación', () => {
    const gk = parseApiFootballGrid('1:1', '4-3-3');
    const def = parseApiFootballGrid('2:2', '4-3-3');
    const fwd = parseApiFootballGrid('4:2', '4-3-3');
    expect(gk).not.toBeNull();
    expect(gk.gridX).toBe(6);
    expect(def.gridX).toBeGreaterThan(20);
    expect(def.gridX).toBeLessThan(40);
    expect(fwd.gridX).toBeGreaterThan(75);
  });

  it('assignFormationGrid devuelve 11 slots para 4-3-3', () => {
    const slots = assignFormationGrid('4-3-3', 11);
    expect(slots).toHaveLength(11);
    expect(slots[0].gridX).toBe(6);
    expect(slots[5].gridX).toBe(58);
    expect(slots[10].gridX).toBe(85);
  });

  it('prioriza positionDetail sobre position cacheado incorrecto', () => {
    const players = [
      { name: 'GK', shirtNumber: 1, position: 'GK', positionDetail: 'Goalkeeper' },
      { name: 'LB', shirtNumber: 2, position: 'DEF', positionDetail: 'Left Back' },
      { name: 'CB1', shirtNumber: 3, position: 'DEF', positionDetail: 'Centre-Back' },
      { name: 'CB2', shirtNumber: 4, position: 'DEF', positionDetail: 'Centre-Back' },
      { name: 'RB', shirtNumber: 5, position: 'DEF', positionDetail: 'Right Back' },
      { name: 'Adams', position: 'DEF', positionDetail: 'Defensive Midfield', shirtNumber: 6 },
      { name: 'CM1', shirtNumber: 7, position: 'MID', positionDetail: 'Central Midfield' },
      { name: 'CM2', shirtNumber: 8, position: 'MID', positionDetail: 'Central Midfield' },
      { name: 'Pulisic', position: 'MID', positionDetail: 'Left Winger', shirtNumber: 10 },
      { name: 'ST', shirtNumber: 9, position: 'FWD', positionDetail: 'Centre-Forward' },
      { name: 'RW', shirtNumber: 11, position: 'FWD', positionDetail: 'Right Winger' },
    ];
    const assigned = assignPlayersToFormation(players, '4-3-3');
    expect(assigned.find((p) => p.name === 'Adams').pitchGridRole).toBe('MCD');
    expect(assigned.find((p) => p.name === 'Pulisic').pitchGridRole).toBe('EI');
    expect(assigned.find((p) => p.name === 'Pulisic').gridX).toBe(85);
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
    expect(assigned.filter((p) => p.gridX === 30)).toHaveLength(4);
  });

  it('mapFootballDataPositionText no clasifica pivote como defensa', () => {
    expect(mapFootballDataPositionText('Defensive Midfield')).toBe('MID');
    expect(mapFootballDataPositionText('Left Wing')).toBe('FWD');
    expect(mapFootballDataPositionText('Right Wing')).toBe('FWD');
  });

  it('mergePlayerGrids usa grid API para profundidad y lateral con XI completo', () => {
    const players = [
      { name: 'A', position: 'GK', gridRaw: '1:1', shirtNumber: 1 },
      { name: 'B', position: 'DEF', gridRaw: '2:2', shirtNumber: 2 },
      { name: 'C', position: 'DEF', gridRaw: '2:3', shirtNumber: 3 },
      { name: 'D', position: 'DEF', gridRaw: '2:4', shirtNumber: 4 },
      { name: 'E', position: 'DEF', gridRaw: '2:5', shirtNumber: 5 },
      { name: 'F', position: 'MID', gridRaw: '3:2', shirtNumber: 6 },
      { name: 'G', position: 'MID', gridRaw: '4:1', shirtNumber: 7 },
      { name: 'H', position: 'MID', gridRaw: '4:2', shirtNumber: 8 },
      { name: 'I', position: 'MID', gridRaw: '4:3', shirtNumber: 9 },
      { name: 'J', position: 'MID', gridRaw: '4:4', shirtNumber: 10 },
      { name: 'K', position: 'FWD', gridRaw: '5:2', shirtNumber: 11 },
    ];
    const merged = mergePlayerGrids(players, '3-1-4-2');
    expect(merged.find((p) => p.name === 'A').gridX).toBe(6);
    expect(merged.find((p) => p.name === 'B').gridX).toBeGreaterThan(20);
    expect(merged.find((p) => p.name === 'B').gridX).toBeLessThan(40);
    expect(merged.find((p) => p.name === 'K').gridX).toBeGreaterThan(75);
    expect(merged.every((p) => p.gridRaw === undefined)).toBe(true);
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
    expect(mapFootballDataPositionText('DF')).toBe('DEF');
    expect(mapFootballDataPositionText('MF')).toBe('MID');
    expect(mapFootballDataPositionText('FW')).toBe('FWD');
  });

  it('coloca MC en mediocampo y DC en ataque en 4-4-2 (cuadrícula)', () => {
    const players = [
      { name: 'Crocombe', shirtNumber: 1, position: 'POR' },
      { name: 'Payne', shirtNumber: 2, position: 'LI' },
      { name: 'Boxall', shirtNumber: 5, position: 'DFC' },
      { name: 'Cacace', shirtNumber: 13, position: 'LD' },
      { name: 'Surman', shirtNumber: 16, position: 'DFC' },
      { name: 'Bell', shirtNumber: 6, position: 'MI' },
      { name: 'Stamenic', shirtNumber: 8, position: 'MD' },
      { name: 'McCowatt', shirtNumber: 20, position: 'MD' },
      { name: 'Singh', shirtNumber: 10, position: 'MC' },
      { name: 'Just', shirtNumber: 11, position: 'MC' },
      { name: 'Wood', shirtNumber: 9, position: 'DC' },
    ];

    expect(attackingMidPromotionScore({ position: 'MC' })).toBeGreaterThan(
      attackingMidPromotionScore({ position: 'MD' })
    );

    const assigned = assignPlayersToFormation(players, '4-4-2');
    const wood = assigned.find((p) => p.shirtNumber === 9);
    const singh = assigned.find((p) => p.shirtNumber === 10);

    expect(wood.gridX).toBe(85);
    expect(wood.pitchGridRole).toBe('DC');
    expect(singh.gridX).toBe(58);
    expect(singh.pitchGridRole).toBe('MC');
    expect(assigned).toHaveLength(11);
    expect(new Set(assigned.map((p) => p.pitchGridCellId)).size).toBe(11);
  });
});
