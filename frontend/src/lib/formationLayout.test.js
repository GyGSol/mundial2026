import { describe, expect, it } from 'vitest';
import {
  assignPlayersToFormation,
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
    expect(Math.abs(ys[0] - ys[1])).toBeGreaterThanOrEqual(20);
    expect(ys.every((y) => y >= 34 && y <= 66)).toBe(true);
  });

  it('spreadForwardCenterClusters abre dos DC amontonados en ataque', () => {
    const players = [
      { name: 'A', shirtNumber: 10, position: 'DC', gridX: 85, gridY: 50 },
      { name: 'B', shirtNumber: 26, position: 'DC', gridX: 85, gridY: 50.5 },
      { name: 'Mid', shirtNumber: 8, position: 'MID', gridX: 58, gridY: 50 },
    ];

    const next = spreadForwardCenterClusters(players);
    expect(next[0].gridY).toBe(36);
    expect(next[1].gridY).toBe(64);
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
    expect(next.find((p) => p.shirtNumber === 25)?.gridY).toBe(54);
    expect(next.find((p) => p.shirtNumber === 20)?.gridY).toBe(86);
    expect(next[0].gridY).not.toBe(next[1].gridY);
  });

  it('spreadMidCenterClusters separa dos mediocampistas centrales superpuestos', () => {
    const players = [
      { name: 'Sanabria', shirtNumber: 25, position: 'MCO', gridX: 64, gridY: 50 },
      { name: 'Araujo', shirtNumber: 20, position: 'MC', gridX: 64, gridY: 50 },
      { name: 'Valverde', shirtNumber: 8, position: 'MI', gridX: 58, gridY: 18 },
    ];

    const next = spreadMidCenterClusters(players);
    expect(next.find((p) => p.shirtNumber === 20)?.gridY).toBe(42);
    expect(next.find((p) => p.shirtNumber === 25)?.gridY).toBe(58);
    expect(next.find((p) => p.shirtNumber === 8)?.gridY).toBe(18);
  });

  it('spreadDefCenterClusters separa dos DFC superpuestos', () => {
    const players = [
      { name: 'Varela', shirtNumber: 13, position: 'DFC', gridX: 26, gridY: 50 },
      { name: 'Gutiérrez', shirtNumber: 4, position: 'DFC', gridX: 26, gridY: 50 },
      { name: 'Cáceres', shirtNumber: 3, position: 'LI', gridX: 26, gridY: 12 },
    ];

    const next = spreadDefCenterClusters(players);
    expect(next.find((p) => p.shirtNumber === 4)?.gridY).toBe(42);
    expect(next.find((p) => p.shirtNumber === 13)?.gridY).toBe(58);
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
    expect(sanabria?.gridY).toBe(54);
    expect(araujo?.gridY).toBe(86);
    expect(Math.abs(sanabria.gridY - araujo.gridY)).toBeGreaterThanOrEqual(16);

    const defenders = laidOut.filter((p) => Number(p.gridX) >= 20 && Number(p.gridX) <= 32);
    expect(defenders).toHaveLength(4);
    expect(new Set(defenders.map((p) => p.gridY)).size).toBe(4);
  });
});
