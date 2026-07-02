import { describe, expect, it } from 'vitest';
import {
  buildMatchResultSlice,
  resolveDuelWinner,
  scoreMatchDuel,
} from './fubolsCupScoring.js';

describe('fubolsCupScoring', () => {
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

  it('2-0 en victorias parciales → gana quien ganó los dos', () => {
    const winner = resolveDuelWinner({
      matchResults: [
        { pointsA: 5, pointsB: 1 },
        { pointsA: 3, pointsB: 0 },
      ],
      playerAId: 'a',
      playerBId: 'b',
      tournamentStatsByUserId: new Map(),
    });
    expect(winner).toBe('a');
  });

  it('1-0 con un partido empatado', () => {
    const winner = resolveDuelWinner({
      matchResults: [
        { pointsA: 3, pointsB: 3 },
        { pointsA: 2, pointsB: 0 },
      ],
      playerAId: 'a',
      playerBId: 'b',
      tournamentStatsByUserId: new Map(),
    });
    expect(winner).toBe('a');
  });

  it('desempate por puntos del torneo', () => {
    const stats = new Map([
      ['a', { totalPoints: 10, name: 'A' }],
      ['b', { totalPoints: 25, name: 'B' }],
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
    expect(winner).toBe('b');
  });

  it('final a 3 partidos: 2-1 en victorias → gana A', () => {
    const winner = resolveDuelWinner({
      matchResults: [
        { pointsA: 5, pointsB: 1 },
        { pointsA: 1, pointsB: 3 },
        { pointsA: 4, pointsB: 2 },
      ],
      playerAId: 'a',
      playerBId: 'b',
      tournamentStatsByUserId: new Map(),
    });
    expect(winner).toBe('a');
  });

  it('final a 3 partidos: 3-0 en victorias → gana A', () => {
    const winner = resolveDuelWinner({
      matchResults: [
        { pointsA: 5, pointsB: 1 },
        { pointsA: 3, pointsB: 0 },
        { pointsA: 4, pointsB: 2 },
      ],
      playerAId: 'a',
      playerBId: 'b',
      tournamentStatsByUserId: new Map(),
    });
    expect(winner).toBe('a');
  });

  it('buildMatchResultSlice sin PB', () => {
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
