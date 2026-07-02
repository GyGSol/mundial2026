import { describe, expect, it } from 'vitest';
import {
  buildMatchResultSlice,
  resolveDuelWinner,
  scoreMatchDuel,
} from '../../shared/fubolsCupScoring.js';

describe('fubolsCupScoring (shared)', () => {
  it('scoreMatchDuel detecta ganador y margen', () => {
    expect(scoreMatchDuel(4, 3)).toEqual({ winner: 'A', margin: 1 });
    expect(scoreMatchDuel(1, 3)).toEqual({ winner: 'B', margin: 2 });
    expect(scoreMatchDuel(2, 2)).toEqual({ winner: null, margin: 0 });
  });

  it('ejemplo canónico 4-3 y 1-3 → pasa B', () => {
    const winner = resolveDuelWinner({
      matchResults: [
        { pointsA: 4, pointsB: 3 },
        { pointsA: 1, pointsB: 3 },
      ],
      playerAId: 'a',
      playerBId: 'b',
      tournamentStatsByUserId: new Map(),
    });
    expect(winner).toBe('b');
  });

  it('desempate por Gdif del torneo (menor gana)', () => {
    const stats = new Map([
      ['a', { totalPoints: 10, difGl: 8, difGv: 6, pj: 10, name: 'A' }],
      ['b', { totalPoints: 25, difGl: 12, difGv: 10, pj: 10, name: 'B' }],
    ]);
    const winner = resolveDuelWinner({
      matchResults: [
        { pointsA: 2, pointsB: 2 },
        { pointsA: 1, pointsB: 1 },
      ],
      playerAId: 'a',
      playerBId: 'b',
      tournamentStatsByUserId: stats,
    });
    expect(winner).toBe('a');
  });

  it('buildMatchResultSlice', () => {
    const row = buildMatchResultSlice({
      matchId: 'm1',
      externalId: '89',
      pointsA: 4,
      pointsB: 3,
      playerAId: 'a',
      playerBId: 'b',
    });
    expect(row.winnerId).toBe('a');
    expect(row.margin).toBe(1);
  });
});
