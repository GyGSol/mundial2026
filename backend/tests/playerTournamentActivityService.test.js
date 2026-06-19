import { describe, expect, it } from 'vitest';
import {
  aggregatePlayerTournamentActivity,
  buildPlayerIdentityKeys,
} from '../src/services/playerTournamentActivityService.js';

describe('playerTournamentActivityService', () => {
  it('buildPlayerIdentityKeys normaliza nombre', () => {
    const keys = buildPlayerIdentityKeys({
      mongoId: '507f1f77bcf86cd799439011',
      externalId: 'MEX-erik-lira',
      fullName: 'Erik Lira',
    });
    expect(keys.mongoIds.has('507f1f77bcf86cd799439011')).toBe(true);
    expect(keys.externalIds.has('MEX-erik-lira')).toBe(true);
    expect(keys.names.has('erik lira')).toBe(true);
  });

  it('cuenta goles, tarjetas y faltas del torneo', () => {
    const raw = {
      fifaEvents: {
        timeline: [
          { type: 'goal', side: 'home', minute: 12, player: 'Erik LIRA' },
          { type: 'yellow_card', side: 'home', minute: 44, player: 'Erik LIRA' },
          { type: 'foul', side: 'home', minute: 70, player: 'Erik LIRA' },
        ],
      },
    };

    const activity = aggregatePlayerTournamentActivity(
      [
        {
          externalId: 'match-1',
          status: 'finished',
          homeTeamId: 'team-mex',
          awayTeamId: 'team-kor',
          homeScore: 2,
          awayScore: 1,
          group: 'A',
          localDate: '2026-06-12',
          raw,
        },
      ],
      [
        { externalId: 'team-mex', fifaCode: 'MEX', nameEn: 'Mexico' },
        { externalId: 'team-kor', fifaCode: 'KOR', nameEn: 'Korea Republic' },
      ],
      [
        {
          _id: '507f1f77bcf86cd799439011',
          externalId: 'MEX-erik-lira',
          fullName: 'Erik LIRA',
          fifaCode: 'MEX',
          teamExternalId: 'team-mex',
          position: 'MID',
          shirtNumber: 6,
        },
      ],
      { externalId: 'MEX-erik-lira', fullName: 'Erik Lira' }
    );

    expect(activity.totals.matches).toBe(1);
    expect(activity.totals.goals).toBe(1);
    expect(activity.totals.yellowCards).toBe(1);
    expect(activity.totals.fouls).toBe(1);
    expect(activity.matches[0].events).toHaveLength(3);
    expect(activity.matches[0].label).toContain('Mexico vs Korea Republic');
  });
});
