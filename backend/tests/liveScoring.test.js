import { describe, expect, it } from 'vitest';
import { calculatePoints } from '../src/services/scoringService.js';

describe('live scoring (provisional)', () => {
  it('al inicio 0-0 otorga puntos a quien acertó el marcador parcial', () => {
    const atKickoff = calculatePoints({ home: 0, away: 0 }, { home: 0, away: 0 });
    expect(atKickoff.total).toBe(6);

    const onlyAwayGoals = calculatePoints({ home: 2, away: 0 }, { home: 0, away: 0 });
    expect(onlyAwayGoals.total).toBe(1);
  });

  it('durante el partido recalcula con el marcador actual', () => {
    const partial = calculatePoints({ home: 2, away: 1 }, { home: 1, away: 0 });
    expect(partial.breakdown.winner).toBe(3);
    expect(partial.total).toBe(3);

    const exact = calculatePoints({ home: 2, away: 1 }, { home: 2, away: 1 });
    expect(exact.total).toBe(6);
  });
});
