import { describe, it, expect } from 'vitest';
import { buildPointsEvolutionFromRaw } from '../../shared/leaderboardEvolution.js';
import { assignPlayerChartColors } from '../../shared/playerChartColors.js';

describe('buildPointsEvolutionFromRaw', () => {
  it('calcula posiciones por checkpoint en orden cronológico', () => {
    const aliceId = 'user-alice';
    const bobId = 'user-bob';
    const match1Id = 'match-1';
    const match2Id = 'match-2';

    const result = buildPointsEvolutionFromRaw({
      group: { id: 'g1', name: 'Test' },
      users: [
        { id: aliceId, name: 'Alice', isAiUser: false, avatarUrl: null },
        { id: bobId, name: 'Bob', isAiUser: false, avatarUrl: null },
      ],
      teams: [
        { externalId: 'arg', fifaCode: 'ARG', nameEn: 'Argentina' },
        { externalId: 'mex', fifaCode: 'MEX', nameEn: 'Mexico' },
        { externalId: 'bra', fifaCode: 'BRA', nameEn: 'Brazil' },
        { externalId: 'fra', fifaCode: 'FRA', nameEn: 'France' },
      ],
      matches: [
        {
          id: match1Id,
          externalId: 'evo-1',
          kickoffAt: '2026-06-11T18:00:00.000Z',
          homeTeamId: 'arg',
          awayTeamId: 'mex',
          homeScore: 2,
          awayScore: 1,
        },
        {
          id: match2Id,
          externalId: 'evo-2',
          kickoffAt: '2026-06-12T18:00:00.000Z',
          homeTeamId: 'bra',
          awayTeamId: 'fra',
          homeScore: 0,
          awayScore: 0,
        },
      ],
      predictions: [
        {
          userId: aliceId,
          matchId: match1Id,
          homeGoals: 2,
          awayGoals: 1,
          pointsEarned: 6,
          bonusPoint: 1,
          pointsBreakdown: { winner: 3, homeGoals: 1, awayGoals: 1, totalGoals: 1 },
        },
        {
          userId: aliceId,
          matchId: match2Id,
          homeGoals: 0,
          awayGoals: 0,
          pointsEarned: 3,
          bonusPoint: 0,
          pointsBreakdown: { winner: 3, homeGoals: 0, awayGoals: 0, totalGoals: 0 },
        },
        {
          userId: bobId,
          matchId: match1Id,
          homeGoals: 1,
          awayGoals: 0,
          pointsEarned: 2,
          bonusPoint: 0,
          pointsBreakdown: { winner: 0, homeGoals: 1, awayGoals: 0, totalGoals: 0 },
        },
        {
          userId: bobId,
          matchId: match2Id,
          homeGoals: 1,
          awayGoals: 1,
          pointsEarned: 4,
          bonusPoint: 0,
          pointsBreakdown: { winner: 3, homeGoals: 0, awayGoals: 0, totalGoals: 1 },
        },
      ],
      hasLiveMatches: false,
    });

    expect(result.checkpoints).toHaveLength(3);
    expect(result.checkpoints[1].label).toBe('ARG · MEX');

    const aliceSeries = result.series.find((row) => row.userId === aliceId);
    const bobSeries = result.series.find((row) => row.userId === bobId);

    expect(aliceSeries.ranks).toEqual([0, 1, 1]);
    expect(bobSeries.ranks).toEqual([0, 2, 2]);

    const colors = assignPlayerChartColors([aliceId, bobId]);
    expect(aliceSeries.color).toBe(colors.get(aliceId));
  });
});
