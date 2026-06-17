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
    expect(computePrizeDistributionPercents(2)).toEqual([67, 33]);
    expect(computePrizeDistributionPercents(3)).toEqual([...DEFAULT_PRIZE_SPLITS]);
    expect(computePrizeDistributionPercents(4)).toEqual([40, 30, 20, 10]);
    expect(computePrizeDistributionPercents(5)).toEqual([33, 27, 20, 13, 7]);
  });

  it('suma 100% para cualquier cantidad', () => {
    for (let n = 1; n <= 10; n += 1) {
      const percents = computePrizeDistributionPercents(n);
      expect(percents.reduce((sum, p) => sum + p, 0)).toBe(100);
    }
  });
});

describe('prize pool projection math', () => {
  it('distribuye proporcional a posición sobre el pozo', () => {
    const total = 1000;
    const percents = computePrizeDistributionPercents(5);
    const amounts = percents.map((p) => Math.floor((total * p) / 100));
    expect(amounts).toEqual([330, 270, 200, 130, 70]);
  });

  it('excluye IA del reparto y asigna premios a humanos', () => {
    const total = 1000;
    const percents = [...DEFAULT_PRIZE_SPLITS];
    const leaderboard = [
      { id: 'ai', name: 'IA', isAiUser: true, rank: 1 },
      { id: 'u2', name: 'B', isAiUser: false, rank: 2 },
      { id: 'u3', name: 'C', isAiUser: false, rank: 3 },
    ];
    const humanWinners = leaderboard.filter((entry) => !entry.isAiUser).slice(0, percents.length);

    const distribution = percents.map((percent, index) => {
      const fubols = Math.floor((total * percent) / 100);
      const entry = humanWinners[index];
      return {
        userId: entry?.id ?? null,
        fubols: entry ? fubols : 0,
        retainedByHouse: 0,
      };
    });

    expect(distribution[0]).toEqual({ userId: 'u2', fubols: 500, retainedByHouse: 0 });
    expect(distribution[1]).toEqual({ userId: 'u3', fubols: 330, retainedByHouse: 0 });
    expect(distribution[2]).toEqual({ userId: null, fubols: 0, retainedByHouse: 0 });
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
        { userId: 'u2', fubols: 330, retainedByHouse: 0, percent: 33 },
        { userId: 'u3', fubols: 170, retainedByHouse: 0, percent: 17 },
      ],
    };

    const enriched = attachProjectedFubolsToLeaderboard(leaderboard, projection);
    expect(enriched[0].projectedFubols).toBe(500);
    expect(enriched[1].projectedFubols).toBe(330);
    expect(enriched[2].projectedFubols).toBe(170);
    expect(enriched[3].projectedFubols).toBeUndefined();
  });
});
