import { describe, it, expect } from 'vitest';
import {
  rankMatchPredictions,
  rankActivePlayersForMatch,
} from '../src/services/matchPredictionRankingsService.js';

describe('matchPredictionRankingsService', () => {
  it('ordena jugadores por puntos sin exponer predicciones', () => {
    const userMap = {
      u1: 'Ana',
      u2: 'Bruno',
      u3: 'Carla',
    };

    const ranked = rankMatchPredictions(
      [
        {
          userId: 'u2',
          pointsEarned: 4,
          pointsBreakdown: { winner: 3, homeGoals: 1, awayGoals: 0, totalGoals: 0 },
        },
        {
          userId: 'u1',
          pointsEarned: 1,
          pointsBreakdown: { winner: 0, homeGoals: 0, awayGoals: 0, totalGoals: 1 },
        },
        {
          userId: 'u3',
          pointsEarned: 0,
          pointsBreakdown: { winner: 0, homeGoals: 0, awayGoals: 0, totalGoals: 0 },
        },
      ],
      userMap
    );

    expect(ranked).toHaveLength(2);
    expect(ranked[0]).toMatchObject({ rank: 1, name: 'Bruno', points: 4, pa: 1, gt: 0 });
    expect(ranked[1]).toMatchObject({ rank: 2, name: 'Ana', points: 1, gt: 1 });
    expect(ranked.every((row) => row.homeGoals === undefined)).toBe(true);
  });

  it('con igualdad de puntos desempata por PA, GL+GV, GT y deja PB al final', () => {
    const userMap = {
      bruno: 'Bruno Díaz',
      federico: 'Federico Paz',
      gabriela: 'Gabriela Sol',
    };

    const ranked = rankMatchPredictions(
      [
        {
          userId: 'bruno',
          pointsEarned: 0,
          bonusPoint: 1,
          bonusReason: 'Punto consuelo (PB): 3 partidos seguidos sin sumar puntos',
          pointsBreakdown: { winner: 0, homeGoals: 0, awayGoals: 0, totalGoals: 0 },
        },
        {
          userId: 'federico',
          pointsEarned: 1,
          bonusPoint: 0,
          pointsBreakdown: { winner: 0, homeGoals: 1, awayGoals: 0, totalGoals: 0 },
        },
        {
          userId: 'gabriela',
          pointsEarned: 1,
          bonusPoint: 0,
          pointsBreakdown: { winner: 0, homeGoals: 0, awayGoals: 1, totalGoals: 0 },
        },
      ],
      userMap
    );

    expect(ranked.map((row) => row.name)).toEqual([
      'Federico Paz',
      'Gabriela Sol',
      'Bruno Díaz',
    ]);
    expect(ranked[2]).toMatchObject({ pb: 1, points: 1 });
  });

  it('rankActivePlayersForMatch incluye jugadores sin predicción con 0 puntos al final', () => {
    const userMap = {
      u1: 'Ana',
      u2: 'Bruno',
      u3: 'Carla',
    };

    const predictionsByUserId = new Map([
      [
        'u1',
        {
          userId: 'u1',
          pointsEarned: 3,
          pointsBreakdown: { winner: 3, homeGoals: 0, awayGoals: 0, totalGoals: 0 },
        },
      ],
      [
        'u2',
        {
          userId: 'u2',
          pointsEarned: 1,
          pointsBreakdown: { winner: 0, homeGoals: 1, awayGoals: 0, totalGoals: 0 },
        },
      ],
    ]);

    const ranked = rankActivePlayersForMatch({
      activeUserIds: ['u1', 'u2', 'u3'],
      predictionsByUserId,
      userMap,
      actual: { home: 2, away: 0 },
    });

    expect(ranked).toHaveLength(3);
    expect(ranked[0].name).toBe('Ana');
    expect(ranked[1].name).toBe('Bruno');
    expect(ranked[2]).toMatchObject({ name: 'Carla', points: 0, rank: 3 });
  });
});
