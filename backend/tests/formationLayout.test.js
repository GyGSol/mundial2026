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
  spreadOverlappingGridPositions,
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

  it('assignPlayersWithFormationLayout usa profundidad del grid API', () => {
    const players = [
      { name: 'GK', position: 'GK', gridRaw: '1:1' },
      { name: 'ST', position: 'FWD', gridRaw: '5:2' },
    ];
    const placed = assignPlayersWithFormationLayout(players, '3-1-4-2');
    expect(placed.find((p) => p.name === 'GK').gridX).toBe(6);
    expect(placed.find((p) => p.name === 'ST').gridX).toBeGreaterThan(75);
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
      { name: 'Adams', position: 'DEF', positionDetail: 'Defensive Midfield', shirtNumber: 6 },
      { name: 'Pulisic', position: 'MID', positionDetail: 'Left Winger', shirtNumber: 10 },
    ];
    const assigned = assignPlayersToFormation(players, '4-3-3');
    expect(assigned.find((p) => p.name === 'Adams').gridX).toBe(52);
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

  it('mergePlayerGrids usa grid API para profundidad y lateral', () => {
    const players = [
      { name: 'A', position: 'GK', gridRaw: '1:1' },
      { name: 'B', position: 'DEF', gridRaw: '2:2' },
      { name: 'C', position: 'FWD', gridRaw: '5:2' },
    ];
    const merged = mergePlayerGrids(players, '3-1-4-2');
    expect(merged[0].gridX).toBe(6);
    expect(merged[1].gridX).toBeGreaterThan(20);
    expect(merged[1].gridX).toBeLessThan(40);
    expect(merged[2].gridX).toBeGreaterThan(75);
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
    expect(mapFootballDataPositionText('DF')).toBe('DEF');
    expect(mapFootballDataPositionText('MF')).toBe('MID');
    expect(mapFootballDataPositionText('FW')).toBe('FWD');
  });

  it('promueve MC como segundo delantero en 4-4-2 con un solo DC', () => {
    const players = [
      { name: 'Crocombe', shirtNumber: 1, position: 'POR' },
      { name: 'Payne', shirtNumber: 2, position: 'LI' },
      { name: 'Boxall', shirtNumber: 5, position: 'DFC' },
      { name: 'Cacace', shirtNumber: 13, position: 'LD' },
      { name: 'Surman', shirtNumber: 16, position: 'DEF' },
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
    expect(singh.gridX).toBeGreaterThan(68);
    expect(singh.gridX).toBeLessThan(85);
    expect(assigned.filter((p) => p.gridX >= 52 && p.gridX <= 64)).toHaveLength(4);
    expect(assigned).toHaveLength(11);
  });
});

describe('formationLayout 4-4-2 Ecuador (EI/ED en mediocampo)', () => {
  it('coloca 4 defensores, 4 medios con extremos y 2 DC separados', () => {
    const players = [
      { name: 'Galíndez', shirtNumber: 1, position: 'POR' },
      { name: 'Hincapié', shirtNumber: 3, position: 'LI' },
      { name: 'Ordóñez', shirtNumber: 4, position: 'DFC' },
      { name: 'Torres', shirtNumber: 2, position: 'DFC' },
      { name: 'Pacho', shirtNumber: 6, position: 'LD' },
      { name: 'Vite', shirtNumber: 15, position: 'MI' },
      { name: 'Yeboah', shirtNumber: 9, position: 'EI' },
      { name: 'Caicedo', shirtNumber: 23, position: 'MC' },
      { name: 'Angulo', shirtNumber: 20, position: 'ED' },
      { name: 'Plata', shirtNumber: 19, position: 'DC' },
      { name: 'Valencia', shirtNumber: 13, position: 'DC' },
    ];

    const laidOut = spreadOverlappingGridPositions(assignPlayersToFormation(players, '4-4-2'));

    expect(laidOut).toHaveLength(11);

    const defenders = laidOut.filter((p) => Number(p.gridX) >= 20 && Number(p.gridX) <= 32);
    expect(defenders).toHaveLength(4);
    expect(new Set(defenders.map((p) => p.gridY)).size).toBe(4);

    const mids = laidOut.filter((p) => Number(p.gridX) >= 52 && Number(p.gridX) <= 64);
    expect(mids).toHaveLength(4);

    const yeboah = laidOut.find((p) => p.shirtNumber === 9);
    const angulo = laidOut.find((p) => p.shirtNumber === 20);
    expect(yeboah.gridX).toBeGreaterThanOrEqual(52);
    expect(yeboah.gridX).toBeLessThanOrEqual(64);
    expect(angulo.gridX).toBeGreaterThanOrEqual(52);
    expect(angulo.gridX).toBeLessThanOrEqual(64);

    const plata = laidOut.find((p) => p.shirtNumber === 19);
    const valencia = laidOut.find((p) => p.shirtNumber === 13);
    expect(plata.gridX).toBe(85);
    expect(valencia.gridX).toBe(85);
    expect(Math.abs(plata.gridY - valencia.gridY)).toBeGreaterThanOrEqual(14);
  });

  it('coloca 4-4-2 con posiciones genéricas FIFA (DEF/MID/FWD)', () => {
    const players = [
      { name: 'Galíndez', shirtNumber: 1, position: 'GK', positionDetail: 'GK' },
      { name: 'Hincapié', shirtNumber: 3, position: 'DEF', positionDetail: 'DEF' },
      { name: 'Ordóñez', shirtNumber: 4, position: 'DEF', positionDetail: 'DEF' },
      { name: 'Pacho', shirtNumber: 6, position: 'DEF', positionDetail: 'DEF' },
      { name: 'Vite', shirtNumber: 15, position: 'MID', positionDetail: 'MID' },
      { name: 'Franco', shirtNumber: 21, position: 'MID', positionDetail: 'MID' },
      { name: 'Caicedo', shirtNumber: 23, position: 'MID', positionDetail: 'MID' },
      { name: 'Yeboah', shirtNumber: 9, position: 'FWD', positionDetail: 'FWD' },
      { name: 'Valencia', shirtNumber: 13, position: 'FWD', positionDetail: 'FWD' },
      { name: 'Plata', shirtNumber: 19, position: 'FWD', positionDetail: 'FWD' },
      { name: 'Angulo', shirtNumber: 20, position: 'FWD', positionDetail: 'FWD' },
    ];

    const laidOut = spreadOverlappingGridPositions(assignPlayersToFormation(players, '4-4-2'));

    expect(laidOut).toHaveLength(11);
    expect(laidOut.filter((p) => p.gridX >= 20 && p.gridX <= 32)).toHaveLength(4);
    expect(laidOut.filter((p) => p.gridX >= 52 && p.gridX <= 64)).toHaveLength(4);
    expect(laidOut.filter((p) => p.gridX >= 80 && p.gridX <= 90)).toHaveLength(2);

    expect(laidOut.find((p) => p.shirtNumber === 9).gridX).toBeGreaterThanOrEqual(52);
    expect(laidOut.find((p) => p.shirtNumber === 20).gridX).toBeGreaterThanOrEqual(52);
    expect(laidOut.find((p) => p.shirtNumber === 13).gridX).toBe(85);
    expect(laidOut.find((p) => p.shirtNumber === 19).gridX).toBe(85);
  });
});

describe('formationLayout 4-2-3-1 Alemania sin regresión', () => {
  it('mantiene 4 defensores, doble pivote, línea de 3 y punta', () => {
    const players = [
      { name: 'Neuer', shirtNumber: 1, position: 'POR' },
      { name: 'Raum', shirtNumber: 22, position: 'LD' },
      { name: 'Kimmich', shirtNumber: 6, position: 'DFC' },
      { name: 'Tah', shirtNumber: 4, position: 'DFC' },
      { name: 'Rüdiger', shirtNumber: 2, position: 'LI' },
      { name: 'Nmecha', shirtNumber: 23, position: 'MC' },
      { name: 'Pavlović', shirtNumber: 5, position: 'MD' },
      { name: 'Musiala', shirtNumber: 10, position: 'MD' },
      { name: 'Sané', shirtNumber: 19, position: 'MCO' },
      { name: 'Wirtz', shirtNumber: 17, position: 'MI' },
      { name: 'Havertz', shirtNumber: 7, position: 'DC' },
    ];

    const laidOut = spreadOverlappingGridPositions(assignPlayersToFormation(players, '4-2-3-1'));

    expect(laidOut).toHaveLength(11);

    const defenders = laidOut.filter((p) => Number(p.gridX) >= 20 && Number(p.gridX) <= 32);
    expect(defenders).toHaveLength(4);

    const doublePivot = laidOut.filter((p) => [23, 5].includes(p.shirtNumber));
    expect(doublePivot).toHaveLength(2);

    const attackingMid = laidOut.filter((p) => [10, 19, 17].includes(p.shirtNumber));
    expect(attackingMid).toHaveLength(3);

    expect(laidOut.find((p) => p.shirtNumber === 7)?.gridX).toBe(85);
  });
});
