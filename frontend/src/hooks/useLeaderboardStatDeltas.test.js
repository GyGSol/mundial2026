import { describe, it, expect } from 'vitest';
import { computeLeaderboardBaselineIndicators } from './useLeaderboardStatDeltas.js';

describe('computeLeaderboardBaselineIndicators', () => {
  const leaderboard = [
    { id: 'a', rank: 2, pa: 13, gl: 5, gv: 6, gt: 4, pb: 0 },
    { id: 'b', rank: 6, pa: 9, gl: 7, gv: 9, gt: 3, pb: 0 },
  ];
  const baseline = [
    { id: 'a', rank: 4, pa: 12, gl: 5, gv: 5, gt: 3, pb: 0 },
    { id: 'b', rank: 2, pa: 10, gl: 7, gv: 10, gt: 3, pb: 0 },
  ];

  it('marca rank ↑↓ y solo subidas verdes en stats en vivo', () => {
    const indicators = computeLeaderboardBaselineIndicators(leaderboard, baseline, {
      hasLiveMatches: true,
    });

    expect(indicators.a.rank).toEqual({ direction: 'up', amount: 2 });
    expect(indicators.a.pa).toEqual({ direction: 'up', count: 1 });
    expect(indicators.a.gv).toEqual({ direction: 'up', count: 1 });

    expect(indicators.b.rank).toEqual({ direction: 'down', amount: 4 });
    expect(indicators.b.pa).toBeUndefined();
    expect(indicators.b.gv).toBeUndefined();
  });

  it('muestra una flecha por partido en vivo que aporta a cada stat', () => {
    const indicators = computeLeaderboardBaselineIndicators(leaderboard, baseline, {
      hasLiveMatches: true,
      leaderboardLiveStatIndicators: {
        liveMatchIds: ['m1', 'm2'],
        byUser: {
          a: {
            pa: [true, true],
            gl: [true, false],
            gv: [false, true],
            gt: [true, true],
            pb: [false, false],
          },
        },
      },
    });

    expect(indicators.a.pa).toEqual({ direction: 'up', count: 2 });
    expect(indicators.a.gl).toEqual({ direction: 'up', count: 1 });
    expect(indicators.a.gv).toEqual({ direction: 'up', count: 1 });
    expect(indicators.a.gt).toEqual({ direction: 'up', count: 2 });
  });
});
