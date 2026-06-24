import { describe, expect, it } from 'vitest';
import {
  assignPlayersToFormation,
  attackingMidPromotionScore,
  isCenterBackLike,
  isCenterForwardLike,
  isCenterMidLike,
  spreadDefCenterClusters,
  spreadForwardCenterClusters,
  spreadMidCenterClusters,
  spreadMidfieldLineOverlaps,
  spreadOverlappingGridPositions,
  spreadCoLocatedPlayers,
  spreadSamePositionOverlaps,
} from './formationLayout.js';

describe('formationLayout center forwards', () => {
  it('isCenterForwardLike detecta DC', () => {
    expect(isCenterForwardLike({ position: 'DC' })).toBe(true);
    expect(isCenterForwardLike({ position: 'MD' })).toBe(false);
  });

  it('assignPlayersToFormation separa dos DC en la misma línea', () => {
    const players = [
      { name: 'Trossard', shirtNumber: 10, position: 'DC' },
      { name: 'Fernandes', shirtNumber: 26, position: 'DC' },
    ];

    const laidOut = assignPlayersToFormation(players, '1-2-2', { includeLeftovers: true });
    const ys = laidOut.map((p) => p.gridY);
    expect(ys).toHaveLength(2);
    expect(Math.abs(ys[0] - ys[1])).toBeGreaterThanOrEqual(24);
    expect(ys.every((y) => y >= 20 && y <= 80)).toBe(true);
  });

  it('spreadForwardCenterClusters abre dos DC amontonados en ataque', () => {
    const players = [
      { name: 'A', shirtNumber: 10, position: 'DC', gridX: 85, gridY: 50 },
      { name: 'B', shirtNumber: 26, position: 'DC', gridX: 85, gridY: 50.5 },
      { name: 'Mid', shirtNumber: 8, position: 'MID', gridX: 58, gridY: 50 },
    ];

    const next = spreadForwardCenterClusters(players);
    expect(next[0].gridY).toBe(28);
    expect(next[1].gridY).toBe(72);
    expect(next[2].gridY).toBe(50);
  });

  it('spreadOverlappingGridPositions separa coordenadas idénticas', () => {
    const players = [
      { name: 'A', shirtNumber: 10, position: 'DC', gridX: 85, gridY: 50 },
      { name: 'B', shirtNumber: 26, position: 'DC', gridX: 85, gridY: 50 },
    ];

    const next = spreadOverlappingGridPositions(players);
    expect(next[0].gridY).not.toBe(next[1].gridY);
    expect(Math.abs(next[0].gridY - next[1].gridY)).toBeGreaterThanOrEqual(14);
  });

  it('spreadSamePositionOverlaps abre dos MI o dos MC en línea horizontal', () => {
    const twoMi = [
      { name: 'Canobbio', shirtNumber: 14, position: 'MI', gridX: 64, gridY: 18 },
      { name: 'Wing', shirtNumber: 7, position: 'MI', gridX: 64, gridY: 18 },
    ];
    const miNext = spreadSamePositionOverlaps(twoMi);
    expect(Math.abs(miNext[0].gridY - miNext[1].gridY)).toBeGreaterThanOrEqual(16);

    const twoMc = [
      { name: 'Sanabria', shirtNumber: 25, position: 'MC', gridX: 64, gridY: 82 },
      { name: 'Valverde', shirtNumber: 15, position: 'MC', gridX: 64, gridY: 82 },
    ];
    const mcNext = spreadSamePositionOverlaps(twoMc);
    expect(Math.abs(mcNext[0].gridY - mcNext[1].gridY)).toBeGreaterThanOrEqual(16);
  });

  it('spreadCoLocatedPlayers separa MD y MCO en la misma celda', () => {
    const players = [
      { name: 'Araujo', shirtNumber: 20, position: 'MID', positionDetail: 'MD', gridX: 64, gridY: 50 },
      { name: 'Sanabria', shirtNumber: 25, position: 'MID', positionDetail: 'MCO', gridX: 64, gridY: 50 },
    ];

    const next = spreadCoLocatedPlayers(players);
    expect(Math.abs(next[0].gridY - next[1].gridY)).toBeGreaterThanOrEqual(16);
  });

  it('spreadOverlappingGridPositions separa MD y MCO superpuestos', () => {
    const players = [
      { name: 'Araujo', shirtNumber: 20, position: 'MID', positionDetail: 'MD', gridX: 64, gridY: 50 },
      { name: 'Sanabria', shirtNumber: 25, position: 'MID', positionDetail: 'MCO', gridX: 64, gridY: 50 },
    ];

    const next = spreadOverlappingGridPositions(players);
    expect(Math.abs(next[0].gridY - next[1].gridY)).toBeGreaterThanOrEqual(16);
  });
});

describe('formationLayout midfield and defense', () => {
  it('isCenterMidLike detecta MC/MCO y excluye bandas', () => {
    expect(isCenterMidLike({ position: 'MCO' })).toBe(true);
    expect(isCenterMidLike({ position: 'MC' })).toBe(true);
    expect(isCenterMidLike({ position: 'MI' })).toBe(false);
    expect(isCenterMidLike({ position: 'MD' })).toBe(false);
    expect(
      isCenterMidLike({ position: 'MD' }, [
        { position: 'MD' },
        { position: 'MD' },
        { position: 'MC' },
      ])
    ).toBe(true);
  });

  it('isCenterBackLike detecta DFC', () => {
    expect(isCenterBackLike({ position: 'DFC' })).toBe(true);
    expect(isCenterBackLike({ position: 'LI' })).toBe(false);
  });

  it('spreadMidfieldLineOverlaps separa MD y MCO superpuestos', () => {
    const players = [
      { name: 'Sanabria', shirtNumber: 25, position: 'MID', positionDetail: 'MCO', gridX: 64, gridY: 50 },
      { name: 'Araujo', shirtNumber: 20, position: 'MID', positionDetail: 'MD', gridX: 64, gridY: 50 },
    ];

    const next = spreadMidfieldLineOverlaps(players);
    expect(next.find((p) => p.shirtNumber === 25)?.gridY).toBe(50);
    expect(next.find((p) => p.shirtNumber === 20)?.gridY).toBe(92);
    expect(next[0].gridY).not.toBe(next[1].gridY);
  });

  it('spreadMidCenterClusters separa dos mediocampistas centrales superpuestos', () => {
    const players = [
      { name: 'Sanabria', shirtNumber: 25, position: 'MCO', gridX: 64, gridY: 50 },
      { name: 'Araujo', shirtNumber: 20, position: 'MC', gridX: 64, gridY: 50 },
      { name: 'Valverde', shirtNumber: 8, position: 'MI', gridX: 58, gridY: 18 },
    ];

    const next = spreadMidCenterClusters(players);
    expect(next.find((p) => p.shirtNumber === 20)?.gridY).toBe(38);
    expect(next.find((p) => p.shirtNumber === 25)?.gridY).toBe(62);
    expect(next.find((p) => p.shirtNumber === 8)?.gridY).toBe(18);
  });

  it('spreadDefCenterClusters separa dos DFC superpuestos', () => {
    const players = [
      { name: 'Varela', shirtNumber: 13, position: 'DFC', gridX: 26, gridY: 50 },
      { name: 'Gutiérrez', shirtNumber: 4, position: 'DFC', gridX: 26, gridY: 50 },
      { name: 'Cáceres', shirtNumber: 3, position: 'LI', gridX: 26, gridY: 12 },
    ];

    const next = spreadDefCenterClusters(players);
    expect(next.find((p) => p.shirtNumber === 4)?.gridY).toBe(38);
    expect(next.find((p) => p.shirtNumber === 13)?.gridY).toBe(62);
    expect(next.find((p) => p.shirtNumber === 3)?.gridY).toBe(12);
  });

  it('assignPlayersToFormation coloca 4 defensores en 4-2-3-1', () => {
    const players = [
      { name: 'Muslera', shirtNumber: 23, position: 'POR' },
      { name: 'Cáceres', shirtNumber: 3, position: 'LI' },
      { name: 'Varela', shirtNumber: 13, position: 'DFC' },
      { name: 'Gutiérrez', shirtNumber: 4, position: 'DFC' },
      { name: 'Olivera', shirtNumber: 16, position: 'LD' },
      { name: 'Ugarte', shirtNumber: 5, position: 'MCD' },
      { name: 'Bentancur', shirtNumber: 6, position: 'MC' },
      { name: 'Valverde', shirtNumber: 8, position: 'MI' },
      { name: 'Sanabria', shirtNumber: 25, position: 'MCO' },
      { name: 'Araujo', shirtNumber: 20, position: 'MD' },
      { name: 'Viñas', shirtNumber: 21, position: 'DC' },
    ];

    const laidOut = assignPlayersToFormation(players, '4-2-3-1', { includeLeftovers: true });
    const sanabria = laidOut.find((p) => p.shirtNumber === 25);
    const araujo = laidOut.find((p) => p.shirtNumber === 20);
    expect(sanabria?.gridY).toBe(50);
    expect(araujo?.gridY).toBe(92);
    expect(Math.abs(sanabria.gridY - araujo.gridY)).toBeGreaterThanOrEqual(16);

    const defenders = laidOut.filter((p) => Number(p.gridX) >= 20 && Number(p.gridX) <= 32);
    expect(defenders).toHaveLength(4);
    expect(new Set(defenders.map((p) => p.gridY)).size).toBe(4);
  });
});

describe('formationLayout 4-4-2 forward promotion', () => {
  it('attackingMidPromotionScore prioriza MC sobre MD y MI', () => {
    expect(attackingMidPromotionScore({ position: 'MC' })).toBeGreaterThan(
      attackingMidPromotionScore({ position: 'MD' })
    );
    expect(attackingMidPromotionScore({ position: 'MD' })).toBeGreaterThan(
      attackingMidPromotionScore({ position: 'MI' })
    );
  });

  it('promueve el mediocampista más ofensivo cuando solo hay un delantero neto', () => {
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

    const laidOut = assignPlayersToFormation(players, '4-4-2', { includeLeftovers: false });
    const wood = laidOut.find((p) => p.shirtNumber === 9);
    const singh = laidOut.find((p) => p.shirtNumber === 10);

    expect(wood.gridX).toBe(85);
    expect(singh.gridX).toBeGreaterThan(68);
    expect(singh.gridX).toBeLessThan(85);
    expect(singh.position).toBe('MID');

    const mids = laidOut.filter((p) => [6, 8, 20, 11].includes(p.shirtNumber));
    expect(mids).toHaveLength(4);
    mids.forEach((p) => {
      expect(p.gridX).toBeGreaterThanOrEqual(52);
      expect(p.gridX).toBeLessThanOrEqual(64);
    });

    expect(laidOut).toHaveLength(11);
  });

  it('assignPlayersToFormation coloca 3 centrales en 3-4-3 sin apilar laterales', () => {
    const players = [
      { name: 'Mosquera', shirtNumber: 22, position: 'GK', positionDetail: 'POR' },
      { name: 'Blackman', shirtNumber: 2, position: 'DEF', positionDetail: 'LI' },
      { name: 'Harvey', shirtNumber: 14, position: 'DEF', positionDetail: 'LI' },
      { name: 'Córdoba', shirtNumber: 3, position: 'DEF', positionDetail: 'DFC' },
      { name: 'Andrade', shirtNumber: 16, position: 'DEF', positionDetail: 'DFC' },
      { name: 'Ramos', shirtNumber: 13, position: 'DEF', positionDetail: 'LD' },
      { name: 'Murillo', shirtNumber: 23, position: 'DEF', positionDetail: 'LD' },
      { name: 'Martínez', shirtNumber: 6, position: 'MID', positionDetail: 'MI' },
      { name: 'Rodríguez', shirtNumber: 7, position: 'MID', positionDetail: 'MD' },
      { name: 'Bárcenas', shirtNumber: 11, position: 'MID', positionDetail: 'MC' },
      { name: 'Fajardo', shirtNumber: 17, position: 'FWD', positionDetail: 'DC' },
    ];

    const laidOut = spreadOverlappingGridPositions(
      assignPlayersToFormation(players, '3-4-3', { includeLeftovers: true })
    );
    const defenders = laidOut.filter(
      (p) => Number(p.gridX) >= 18 && Number(p.gridX) <= 42
    );

    expect(defenders).toHaveLength(3);
    expect(new Set(defenders.map((p) => p.gridY)).size).toBe(3);
    expect(defenders.map((p) => p.shirtNumber).sort((a, b) => a - b)).toEqual([2, 3, 13]);

    const harvey = laidOut.find((p) => p.shirtNumber === 14);
    expect(harvey?.gridX).toBeGreaterThan(40);
  });

  it('assignPlayersToFormation agrupa MC y dos MD en el centro en 5-4-1', () => {
    const players = [
      { name: 'Asare', shirtNumber: 16, position: 'POR' },
      { name: 'Adjetey', shirtNumber: 4, position: 'LI' },
      { name: 'Mensah', shirtNumber: 14, position: 'DFC' },
      { name: 'Opoku', shirtNumber: 18, position: 'DFC' },
      { name: 'Koufie', shirtNumber: 15, position: 'DFC' },
      { name: 'Senaya', shirtNumber: 26, position: 'LD' },
      { name: 'Yirenkyi', shirtNumber: 3, position: 'MI' },
      { name: 'Semenyo', shirtNumber: 11, position: 'MC' },
      { name: 'Sibo', shirtNumber: 8, position: 'MD' },
      { name: 'Partey', shirtNumber: 5, position: 'MD' },
      { name: 'Ayew', shirtNumber: 9, position: 'DC' },
    ];

    const laidOut = assignPlayersToFormation(players, '5-4-1', { includeLeftovers: true });
    const yirenkyi = laidOut.find((p) => p.shirtNumber === 3);
    const semenyo = laidOut.find((p) => p.shirtNumber === 11);
    const sibo = laidOut.find((p) => p.shirtNumber === 8);
    const partey = laidOut.find((p) => p.shirtNumber === 5);

    expect(yirenkyi?.gridY).toBeLessThanOrEqual(12);
    expect(semenyo?.gridY).toBeGreaterThanOrEqual(28);
    expect(semenyo?.gridY).toBeLessThanOrEqual(72);
    expect(sibo?.gridY).toBeGreaterThanOrEqual(28);
    expect(sibo?.gridY).toBeLessThanOrEqual(72);
    expect(partey?.gridY).toBeGreaterThanOrEqual(28);
    expect(partey?.gridY).toBeLessThanOrEqual(72);
    expect(new Set([semenyo?.gridY, sibo?.gridY, partey?.gridY]).size).toBe(3);
    expect(semenyo?.gridY).not.toBe(92);
  });
});
