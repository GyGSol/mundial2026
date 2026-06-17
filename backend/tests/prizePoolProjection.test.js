import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PRIZE_SPLITS,
  computePrizeDistributionPercents,
} from '../src/config/economy.js';
import { attachProjectedFubolsToLeaderboard } from '../src/services/prizePoolService.js';

describe('computePrizeDistributionPercents', () => {
  it('devuelve porcentajes según cantidad de premiados', () => {
    expect(computePrizeDistributionPercents(0)).toEqual([]);
    expect(computePrizeDistributionPercents(1)).toEqual([100]);
    expect(computePrizeDistributionPercents(2)).toEqual([60, 40]);
    expect(computePrizeDistributionPercents(3)).toEqual([...DEFAULT_PRIZE_SPLITS]);
    expect(computePrizeDistributionPercents(4)).toEqual([25, 25, 25, 25]);
    expect(computePrizeDistributionPercents(5)).toEqual([20, 20, 20, 20, 20]);
  });

  it('suma 100% para cualquier cantidad', () => {
    for (let n = 1; n <= 10; n += 1) {
      const percents = computePrizeDistributionPercents(n);
      expect(percents.reduce((sum, p) => sum + p, 0)).toBe(100);
    }
  });
});

describe('prize pool projection math', () => {
  it('distribuye 50/30/20 sobre el pozo', () => {
    const total = 1000;
    const percents = [...DEFAULT_PRIZE_SPLITS];
    const amounts = percents.map((p) => Math.floor((total * p) / 100));
    expect(amounts).toEqual([500, 300, 200]);
  });

  it('retiene premio de IA en La Casa', () => {
    const total = 1000;
    const percents = [...DEFAULT_PRIZE_SPLITS];
    const leaderboard = [
      { id: 'ai', name: 'IA', isAiUser: true, rank: 1 },
      { id: 'u2', name: 'B', isAiUser: false, rank: 2 },
      { id: 'u3', name: 'C', isAiUser: false, rank: 3 },
    ];

    let houseRetention = 0;
    const distribution = percents.map((percent, index) => {
      const fubols = Math.floor((total * percent) / 100);
      const entry = leaderboard[index];
      if (entry?.isAiUser) {
        houseRetention += fubols;
        return { fubols: 0, retainedByHouse: fubols };
      }
      return { fubols, retainedByHouse: 0 };
    });

    expect(distribution[0]).toEqual({ fubols: 0, retainedByHouse: 500 });
    expect(distribution[1]).toEqual({ fubols: 300, retainedByHouse: 0 });
    expect(houseRetention).toBe(500);
  });

  it('adjunta premios proyectados a filas del ranking', () => {
    const leaderboard = [
      { id: 'u1', name: 'A', rank: 1 },
      { id: 'u2', name: 'B', rank: 2 },
      { id: 'u3', name: 'C', rank: 3 },
      { id: 'u4', name: 'D', rank: 4 },
    ];
    const projection = {
      distribution: [
        { userId: 'u1', fubols: 500, retainedByHouse: 0, percent: 50 },
        { userId: 'u2', fubols: 300, retainedByHouse: 0, percent: 30 },
        { userId: 'u3', fubols: 0, retainedByHouse: 200, percent: 20, isAiUser: true },
      ],
    };

    const enriched = attachProjectedFubolsToLeaderboard(leaderboard, projection);
    expect(enriched[0].projectedFubols).toBe(500);
    expect(enriched[1].projectedFubols).toBe(300);
    expect(enriched[2].fubolsRetainedByHouse).toBe(200);
    expect(enriched[3].projectedFubols).toBeUndefined();
  });
});
