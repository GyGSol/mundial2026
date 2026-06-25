import { describe, expect, it } from 'vitest';
import { computePredictedGroupStandings } from '../src/services/predictedGroupStandingsService.js';

describe('computePredictedGroupStandings — pareja simultánea', () => {
  const teams = [
    { externalId: '18', nameEn: 'Team 18', group: 'E' },
    { externalId: '19', nameEn: 'Team 19', group: 'E' },
    { externalId: '20', nameEn: 'Team 20', group: 'E' },
    { externalId: '17', nameEn: 'Team 17', group: 'E' },
  ];

  const kickoff = new Date('2026-06-25T20:00:00.000Z');

  it('omite predicciones excluidas del par simultáneo', () => {
    const matches = [
      {
        _id: 'm55',
        externalId: '55',
        group: 'E',
        matchday: '3',
        homeTeamId: '18',
        awayTeamId: '19',
        status: 'upcoming',
        kickoffAt: kickoff,
      },
      {
        _id: 'm56',
        externalId: '56',
        group: 'E',
        matchday: '3',
        homeTeamId: '20',
        awayTeamId: '17',
        status: 'upcoming',
        kickoffAt: kickoff,
      },
    ];

    const withBothPredictions = new Map([
      ['m55', { homeGoals: 2, awayGoals: 0, userSubmitted: true }],
      ['m56', { homeGoals: 0, awayGoals: 1, userSubmitted: true }],
    ]);

    const excludingPair = new Map();

    const projectedBoth = computePredictedGroupStandings(teams, matches, withBothPredictions);
    const projectedExcluded = computePredictedGroupStandings(teams, matches, excludingPair);

    const pointsBoth = Object.fromEntries(
      projectedBoth[0].standings.map((row) => [row.teamId, row.points])
    );
    const pointsExcluded = Object.fromEntries(
      projectedExcluded[0].standings.map((row) => [row.teamId, row.points])
    );

    expect(pointsBoth['17']).toBe(3);
    expect(pointsExcluded['17'] ?? 0).toBe(0);
    expect(projectedBoth[0].matchCounts.predicted).toBe(2);
    expect(projectedExcluded[0].matchCounts.predicted).toBe(0);
    expect(projectedExcluded[0].matchCounts.omitted).toBe(2);
  });
});
