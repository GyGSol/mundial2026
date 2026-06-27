import { describe, it, expect, vi } from 'vitest';
import {
  collectWorldCup26SyncWarning,
  buildSourceDisputes,
  auditMatchIntegrity,
} from '../src/services/matchIntegrityAuditService.js';

vi.mock('../src/services/predictionMatchLinkService.js', () => ({
  auditPredictionMatchLinks: vi.fn(),
  loadFifaFixtureContext: vi.fn(),
}));

import {
  auditPredictionMatchLinks,
  loadFifaFixtureContext,
} from '../src/services/predictionMatchLinkService.js';

vi.mock('../src/models/Match.js', () => ({
  Match: { find: vi.fn() },
}));

vi.mock('../src/models/Prediction.js', () => ({
  Prediction: { find: vi.fn() },
}));

vi.mock('../src/models/Team.js', () => ({
  Team: { find: vi.fn() },
}));

import { Match } from '../src/models/Match.js';
import { Prediction } from '../src/models/Prediction.js';
import { Team } from '../src/models/Team.js';

describe('matchIntegrityAuditService', () => {
  it('detecta teams_mismatch cuando worldcup26 id colisiona con slot FIFA', () => {
    const warning = collectWorldCup26SyncWarning({
      rawGame: {
        id: 15,
        home_team_name_en: 'Belgium',
        away_team_name_en: 'Egypt',
        finished: 'TRUE',
        time_elapsed: 'finished',
      },
      doc: {
        externalId: '15',
        homeTeamId: '25',
        awayTeamId: '26',
        localDate: '06/15/2026 12:00',
      },
      existing: {
        _id: 'slot-15',
        externalId: '15',
        homeTeamId: '27',
        awayTeamId: '28',
      },
    });

    expect(warning.type).toBe('teams_mismatch');
    expect(warning.idCollision).toBe(false);
    expect(warning.summary).toContain('worldcup26 id=15');
  });

  it('detecta id_collision cuando el par coincide pero el id numérico difiere', () => {
    const warning = collectWorldCup26SyncWarning({
      rawGame: { id: 13 },
      doc: {
        externalId: '13',
        homeTeamId: '27',
        awayTeamId: '28',
      },
      existing: {
        _id: 'slot-15',
        externalId: '15',
        homeTeamId: '27',
        awayTeamId: '28',
      },
    });

    expect(warning.type).toBe('id_collision');
    expect(warning.idCollision).toBe(true);
  });

  it('arma disputas teams_mismatch desde warnings worldcup26', () => {
    const matches = [
      {
        _id: 'slot-15',
        externalId: '15',
        homeTeamId: '27',
        awayTeamId: '28',
        group: 'G',
        matchday: '1',
        kickoffAt: new Date('2026-06-16T01:00:00.000Z'),
        status: 'live',
      },
    ];
    const teams = [
      { externalId: '27', fifaCode: 'IRN', nameEn: 'Iran' },
      { externalId: '28', fifaCode: 'NZL', nameEn: 'New Zealand' },
    ];
    const fifaTargets = new Map([
      [
        '15',
        {
          externalId: '15',
          homeCode: 'IRN',
          awayCode: 'NZL',
          group: 'G',
        },
      ],
    ]);
    const teamCodeById = new Map([
      ['27', 'IRN'],
      ['28', 'NZL'],
    ]);

    const disputes = buildSourceDisputes({
      matches,
      teams,
      fifaTargets,
      teamCodeById,
      worldcup26Warnings: [
        {
          type: 'teams_mismatch',
          targetMatchExternalId: '15',
          summary: 'BEL-EGY vs IRN-NZL',
          worldcup26GameId: '15',
          worldcup26HomeName: 'Belgium',
          worldcup26AwayName: 'Egypt',
          worldcup26LocalDate: '06/15/2026 12:00',
          worldcup26Finished: 'TRUE',
          worldcup26TimeElapsed: 'finished',
        },
      ],
    });

    expect(disputes).toHaveLength(1);
    expect(disputes[0].type).toBe('teams_mismatch');
    expect(disputes[0].fifa.homeCode).toBe('IRN');
    expect(disputes[0].wc26.homeName).toBe('Belgium');
  });

  it('reutiliza predictionLinkAudit precalculado sin volver a auditar links', async () => {
    Match.find.mockReturnValue({
      lean: vi.fn().mockResolvedValue([
        {
          _id: 'm1',
          externalId: '1',
          homeTeamId: 'h1',
          awayTeamId: 'a1',
          group: 'A',
          kickoffAt: new Date('2026-06-11T19:00:00.000Z'),
          status: 'upcoming',
        },
      ]),
    });
    Prediction.find.mockReturnValue({ lean: vi.fn().mockResolvedValue([]) });
    Team.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { externalId: 'h1', fifaCode: 'MEX', nameEn: 'Mexico' },
          { externalId: 'a1', fifaCode: 'RSA', nameEn: 'South Africa' },
        ]),
      }),
    });
    loadFifaFixtureContext.mockResolvedValue({
      targets: new Map([
        ['1', { externalId: '1', homeCode: 'MEX', awayCode: 'RSA', group: 'A' }],
      ]),
      teamCodeById: new Map([
        ['h1', 'MEX'],
        ['a1', 'RSA'],
      ]),
    });

    const precalculated = {
      summary: { hasIssues: false, orphanCount: 0 },
      slotMismatches: [],
    };

    await auditMatchIntegrity({ predictionLinkAudit: precalculated });

    expect(auditPredictionMatchLinks).not.toHaveBeenCalled();
  });
});
