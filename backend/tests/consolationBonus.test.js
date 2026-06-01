import { describe, it, expect } from 'vitest';
import {
  CONSOLATION_BONUS,
  CONSOLATION_REASON,
  CONSOLATION_STREAK,
} from '../src/services/consolationBonusService.js';
import { rankMatchPredictions } from '../src/services/matchPredictionRankingsService.js';

describe('consolationBonusService constants', () => {
  it('define racha de 3 partidos y bonus de 1 punto', () => {
    expect(CONSOLATION_STREAK).toBe(3);
    expect(CONSOLATION_BONUS).toBe(1);
    expect(CONSOLATION_REASON).toContain('3 partidos');
  });
});

describe('match rankings with PB', () => {
  it('incluye bonus y motivo en el ranking del partido', () => {
    const userMap = { u1: 'Ana' };
    const ranked = rankMatchPredictions(
      [
        {
          userId: 'u1',
          pointsEarned: 0,
          bonusPoint: 1,
          bonusReason: CONSOLATION_REASON,
          pointsBreakdown: { winner: 0, homeGoals: 0, awayGoals: 0, totalGoals: 0 },
        },
      ],
      userMap
    );

    expect(ranked).toHaveLength(1);
    expect(ranked[0]).toMatchObject({
      points: 1,
      pb: 1,
      bonusReason: CONSOLATION_REASON,
    });
  });
});
