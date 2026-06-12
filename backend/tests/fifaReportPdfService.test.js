import { describe, expect, it } from 'vitest';
import {
  matchesFifaReportIdentity,
  parseMatchStatisticsFromText,
} from '../src/services/fifaReportPdfService.js';

const MEXICO_RSA_STATS = `
Mexico (MEX)South Africa (RSA)Statistics
61%Ball possession39%
16 / 4Attempts at Goal (Total/On Target)3 / 2
4Attempts at Goal blocked0
12Fouls Against11
3Corners1
11Direct free kicks12
1Indirect free kicks1
0 / 0Penalties (total/scored)0 / 0
1Offsides1
0Own goals0
1Yellow cards2
0Red Cards for second caution0
1Direct red cards2
`;

const KOREA_CZECH_HEADER = `
Group A Korea Republic v. Czechia 2-1 (0-1) #2 | 11 June 2026 | TORONTO / BMO Field / CAN / Attendance: 45,000
Korea Republic (KOR) Statistics Czechia (CZE)
`;

const KOREA_CZECH_STATS = `
Korea Republic (KOR) Statistics Czechia (CZE)
52%Ball possession48%
14 / 6Attempts at Goal (Total/On Target)9 / 3
2Attempts at Goal blocked1
8Fouls Against16
5Corners2
9Direct free kicks11
0 / 0Penalties (total/scored)0 / 0
2Offsides0
0Own goals0
1Yellow cards0
0Red Cards for second caution0
0Direct red cards0
`;

describe('matchesFifaReportIdentity', () => {
  it('acepta nombres FIFA aunque el equipo en DB sea South Korea / Czech Republic', () => {
    expect(
      matchesFifaReportIdentity(KOREA_CZECH_HEADER, {
        homeName: 'South Korea',
        awayName: 'Czech Republic',
        matchNumber: 2,
        homeFifaCode: 'KOR',
        awayFifaCode: 'CZE',
        homeAliases: ['Korea Republic'],
        awayAliases: ['Czechia'],
      })
    ).toBe(true);
  });

  it('rechaza PDF de otro partido', () => {
    expect(
      matchesFifaReportIdentity(KOREA_CZECH_HEADER, {
        homeName: 'Mexico',
        awayName: 'South Africa',
        matchNumber: 1,
      })
    ).toBe(false);
  });
});

describe('parseMatchStatisticsFromText', () => {
  it('extrae posesión, tiros, faltas y tarjetas del bloque Statistics', () => {
    const stats = parseMatchStatisticsFromText(MEXICO_RSA_STATS);
    expect(stats?.home).toMatchObject({
      possession: 61,
      attemptsTotal: 16,
      attemptsOnTarget: 4,
      attemptsBlocked: 4,
      foulsAgainst: 12,
      corners: 3,
      directFreeKicks: 11,
      indirectFreeKicks: 1,
      penaltiesTotal: 0,
      penaltiesScored: 0,
      offsides: 1,
      ownGoals: 0,
      yellowCards: 1,
      redCardsSecondYellow: 0,
      directRedCards: 1,
    });
    expect(stats?.away).toMatchObject({
      possession: 39,
      attemptsTotal: 3,
      attemptsOnTarget: 2,
      attemptsBlocked: 0,
      foulsAgainst: 11,
      corners: 1,
      directFreeKicks: 12,
      yellowCards: 2,
      directRedCards: 2,
    });
  });

  it('extrae stats con encabezado Korea Republic / Czechia', () => {
    const stats = parseMatchStatisticsFromText(KOREA_CZECH_STATS);
    expect(stats?.home).toMatchObject({
      possession: 52,
      attemptsTotal: 14,
      attemptsOnTarget: 6,
      foulsAgainst: 8,
      corners: 5,
      yellowCards: 1,
    });
    expect(stats?.away).toMatchObject({
      possession: 48,
      attemptsTotal: 9,
      attemptsOnTarget: 3,
      foulsAgainst: 16,
      corners: 2,
    });
  });
});
