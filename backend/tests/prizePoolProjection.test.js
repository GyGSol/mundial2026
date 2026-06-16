import { describe, it, expect } from 'vitest';
import { DEFAULT_PRIZE_SPLITS } from '../src/config/economy.js';

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
});
