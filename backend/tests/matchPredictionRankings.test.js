import { describe, it, expect } from 'vitest';
import {
  rankMatchPredictions,
  rankActivePlayersForMatch,
  rankActivePlayersForMatchBatch,
  compareEliminationRoundRank,
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

  it('rankActivePlayersForMatchBatch con zeroPoints ordena por Gdif cuando todos tienen 0 pts', () => {
    const userMap = { u1: 'Ana', u2: 'Bruno', u3: 'Carla' };
    const kickoff = new Date('2026-06-20T18:00:00Z');
    const matches = [
      {
        _id: 'm1',
        status: 'upcoming',
        kickoffAt: kickoff,
        homeScore: null,
        awayScore: null,
      },
    ];
    const predictionsByUserIdAndMatchId = new Map([
      [
        'u1:m1',
        { userId: 'u1', homeGoals: 2, awayGoals: 1, goalDiffHome: 2, goalDiffAway: 1 },
      ],
      [
        'u2:m1',
        { userId: 'u2', homeGoals: 1, awayGoals: 0, goalDiffHome: 1, goalDiffAway: 0 },
      ],
      [
        'u3:m1',
        { userId: 'u3', homeGoals: 0, awayGoals: 0, goalDiffHome: 0, goalDiffAway: 0 },
      ],
    ]);

    const ranked = rankActivePlayersForMatchBatch({
      activeUserIds: ['u1', 'u2', 'u3'],
      matches,
      predictionsByUserIdAndMatchId,
      userMap,
      zeroPoints: true,
    });

    expect(ranked.every((row) => row.points === 0)).toBe(true);
    expect(ranked[0].name).toBe('Carla');
    expect(ranked[1].name).toBe('Bruno');
    expect(ranked[2].name).toBe('Ana');
  });

  it('rankActivePlayersForMatchBatch suma puntos de dos partidos del mismo slot', () => {
    const userMap = { u1: 'Ana', u2: 'Bruno' };
    const kickoff = new Date('2026-06-20T18:00:00Z');
    const matches = [
      {
        _id: 'm1',
        status: 'finished',
        kickoffAt: kickoff,
        homeScore: 2,
        awayScore: 0,
      },
      {
        _id: 'm2',
        status: 'finished',
        kickoffAt: kickoff,
        homeScore: 1,
        awayScore: 1,
      },
    ];
    const predictionsByUserIdAndMatchId = new Map([
      [
        'u1:m1',
        {
          userId: 'u1',
          homeGoals: 2,
          awayGoals: 0,
          pointsEarned: 6,
          pointsBreakdown: { winner: 3, homeGoals: 1, awayGoals: 1, totalGoals: 1 },
        },
      ],
      [
        'u1:m2',
        {
          userId: 'u1',
          homeGoals: 1,
          awayGoals: 1,
          pointsEarned: 4,
          pointsBreakdown: { winner: 1, homeGoals: 1, awayGoals: 1, totalGoals: 1 },
        },
      ],
      [
        'u2:m1',
        {
          userId: 'u2',
          homeGoals: 0,
          awayGoals: 0,
          pointsEarned: 0,
          pointsBreakdown: { winner: 0, homeGoals: 0, awayGoals: 0, totalGoals: 0 },
        },
      ],
      [
        'u2:m2',
        {
          userId: 'u2',
          homeGoals: 0,
          awayGoals: 0,
          pointsEarned: 0,
          pointsBreakdown: { winner: 0, homeGoals: 0, awayGoals: 0, totalGoals: 0 },
        },
      ],
    ]);

    const ranked = rankActivePlayersForMatchBatch({
      activeUserIds: ['u1', 'u2'],
      matches,
      predictionsByUserIdAndMatchId,
      userMap,
      zeroPoints: false,
    });

    expect(ranked[0]).toMatchObject({ name: 'Ana', points: 10, pj: 2 });
    expect(ranked[1]).toMatchObject({ name: 'Bruno', points: 0, pj: 2 });
  });

  it('compareEliminationRoundRank prioriza Gdif con empate a 0 puntos', () => {
    const better = { name: 'Ana', points: 0, difGl: 0, difGv: 0, pj: 1 };
    const worse = { name: 'Bruno', points: 0, difGl: 3, difGv: 2, pj: 1 };
    expect(compareEliminationRoundRank(better, worse)).toBeLessThan(0);
  });
});
