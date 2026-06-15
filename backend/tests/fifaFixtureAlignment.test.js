import { describe, it, expect } from 'vitest';
import {
  buildFifaFixtureTargets,
  buildTeamIdByFifaCode,
  resolveTeamExternalId,
} from '../src/services/fifaFixtureAlignmentService.js';

const teams = [
  { externalId: '10', fifaCode: 'BEL' },
  { externalId: '11', fifaCode: 'EGY' },
  { externalId: '12', fifaCode: 'KSA' },
  { externalId: '13', fifaCode: 'URU' },
  { externalId: '14', fifaCode: 'IRN' },
  { externalId: '15', fifaCode: 'NZL' },
];

describe('fifaFixtureAlignmentService', () => {
  it('resuelve alias FIFA SAU → KSA', () => {
    const map = buildTeamIdByFifaCode([{ externalId: '99', fifaCode: 'KSA' }]);
    expect(resolveTeamExternalId('SAU', map)).toBe('99');
  });

  it('arma fixture objetivo desde calendario FIFA', () => {
    const map = buildTeamIdByFifaCode(teams);
    const targets = buildFifaFixtureTargets(
      [
        {
          MatchNumber: 16,
          Home: { Abbreviation: 'BEL' },
          Away: { Abbreviation: 'EGY' },
          GroupName: [{ Locale: 'en-GB', Description: 'Group G' }],
          IdMatch: '400021478',
          IdStage: '289273',
        },
        {
          MatchNumber: 13,
          Home: { Abbreviation: 'KSA' },
          Away: { Abbreviation: 'URU' },
          GroupName: [{ Locale: 'en-GB', Description: 'Group H' }],
          IdMatch: '400021475',
          IdStage: '289273',
        },
      ],
      map
    );

    expect(targets.get('16')).toMatchObject({
      homeCode: 'BEL',
      awayCode: 'EGY',
      homeTeamId: '10',
      awayTeamId: '11',
      group: 'G',
    });
    expect(targets.get('13')).toMatchObject({
      homeCode: 'KSA',
      awayCode: 'URU',
      homeTeamId: '12',
      awayTeamId: '13',
      group: 'H',
    });
  });
});
