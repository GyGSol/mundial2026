import { describe, it, expect } from 'vitest';
import { annotateGroupQualification } from '../src/services/worldCupStatsService.js';
import { computePredictedGroupStandings } from '../src/services/predictedGroupStandingsService.js';

const teams = [
  { externalId: '1', nameEn: 'Mexico', fifaCode: 'MEX', group: 'A', flag: '🇲🇽' },
  { externalId: '2', nameEn: 'South Africa', fifaCode: 'RSA', group: 'A', flag: '🇿🇦' },
  { externalId: '3', nameEn: 'Brazil', fifaCode: 'BRA', group: 'A', flag: '🇧🇷' },
  { externalId: '4', nameEn: 'Morocco', fifaCode: 'MAR', group: 'A', flag: '🇲🇦' },
];

describe('predictedGroupStandingsService', () => {
  it('mezcla partidos finalizados (reales) y pendientes con userSubmitted', () => {
    const matches = [
      {
        id: 'm1',
        homeTeamId: '1',
        awayTeamId: '2',
        homeScore: 2,
        awayScore: 1,
        group: 'A',
        type: 'group',
        status: 'finished',
      },
      {
        id: 'm2',
        homeTeamId: '3',
        awayTeamId: '4',
        homeScore: 0,
        awayScore: 0,
        group: 'A',
        type: 'group',
        status: 'upcoming',
      },
    ];

    const predictionsByMatchId = new Map([
      ['m2', { homeGoals: 1, awayGoals: 1, userSubmitted: true }],
    ]);

    const result = computePredictedGroupStandings(teams, matches, predictionsByMatchId);
    expect(result).toHaveLength(1);
    expect(result[0].matchCounts).toEqual({ real: 1, predicted: 1, omitted: 0 });

    const mexico = result[0].standings.find((row) => row.teamId === '1');
    const brazil = result[0].standings.find((row) => row.teamId === '3');
    expect(mexico?.played).toBe(1);
    expect(mexico?.points).toBe(3);
    expect(brazil?.played).toBe(1);
    expect(brazil?.points).toBe(1);
  });

  it('omite partidos sin userSubmitted (incluye default 0-0 automático)', () => {
    const matches = [
      {
        id: 'm1',
        homeTeamId: '1',
        awayTeamId: '2',
        homeScore: 0,
        awayScore: 0,
        group: 'A',
        type: 'group',
        status: 'upcoming',
      },
      {
        id: 'm2',
        homeTeamId: '3',
        awayTeamId: '4',
        homeScore: 0,
        awayScore: 0,
        group: 'A',
        type: 'group',
        status: 'upcoming',
      },
    ];

    const predictionsByMatchId = new Map([
      ['m1', { homeGoals: 0, awayGoals: 0, userSubmitted: false }],
    ]);

    const result = computePredictedGroupStandings(teams, matches, predictionsByMatchId);
    expect(result[0].matchCounts).toEqual({ real: 0, predicted: 0, omitted: 2 });
    expect(result[0].standings.every((row) => row.played === 0)).toBe(true);
  });

  it('usa predicción explícita en partido pendiente cerrado', () => {
    const matches = [
      {
        id: 'm1',
        homeTeamId: '3',
        awayTeamId: '4',
        homeScore: 0,
        awayScore: 0,
        group: 'A',
        type: 'group',
        status: 'upcoming',
      },
    ];

    const predictionsByMatchId = new Map([
      ['m1', { homeGoals: 2, awayGoals: 1, userSubmitted: true }],
    ]);

    const result = computePredictedGroupStandings(teams, matches, predictionsByMatchId);
    const brazil = result[0].standings.find((row) => row.teamId === '3');
    expect(brazil?.points).toBe(3);
    expect(result[0].matchCounts.predicted).toBe(1);
  });

  it('aplica zonas de clasificación cuando hay datos suficientes', () => {
    const matches = [
      {
        id: 'm1',
        homeTeamId: '1',
        awayTeamId: '2',
        homeScore: 3,
        awayScore: 0,
        group: 'A',
        type: 'group',
        status: 'finished',
      },
      {
        id: 'm2',
        homeTeamId: '3',
        awayTeamId: '4',
        homeScore: 2,
        awayScore: 0,
        group: 'A',
        type: 'group',
        status: 'finished',
      },
    ];

    const annotated = annotateGroupQualification(
      computePredictedGroupStandings(teams, matches, new Map())
    );

    expect(annotated[0].standings[0].qualificationZone).toBe('direct');
    expect(annotated[0].standings[1].qualificationZone).toBe('direct');
  });
});
