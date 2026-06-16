import { describe, it, expect } from 'vitest';
import {
  collectWorldCup26SyncWarning,
  buildSourceDisputes,
} from '../src/services/matchIntegrityAuditService.js';

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
});
