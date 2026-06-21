import { describe, expect, it } from 'vitest';
import {
  assignPlayersToFormation,
  isCenterForwardLike,
  spreadForwardCenterClusters,
  spreadOverlappingGridPositions,
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
    expect(Math.abs(ys[0] - ys[1])).toBeGreaterThanOrEqual(6);
    expect(ys.every((y) => y >= 40 && y <= 60)).toBe(true);
  });

  it('spreadForwardCenterClusters abre dos DC amontonados en ataque', () => {
    const players = [
      { name: 'A', shirtNumber: 10, position: 'DC', gridX: 85, gridY: 50 },
      { name: 'B', shirtNumber: 26, position: 'DC', gridX: 85, gridY: 50.5 },
      { name: 'Mid', shirtNumber: 8, position: 'MID', gridX: 58, gridY: 50 },
    ];

    const next = spreadForwardCenterClusters(players);
    expect(next[0].gridY).toBe(46);
    expect(next[1].gridY).toBe(54);
    expect(next[2].gridY).toBe(50);
  });

  it('spreadOverlappingGridPositions separa coordenadas idénticas', () => {
    const players = [
      { name: 'A', shirtNumber: 10, position: 'DC', gridX: 85, gridY: 50 },
      { name: 'B', shirtNumber: 26, position: 'DC', gridX: 85, gridY: 50 },
    ];

    const next = spreadOverlappingGridPositions(players);
    expect(next[0].gridY).not.toBe(next[1].gridY);
  });
});
