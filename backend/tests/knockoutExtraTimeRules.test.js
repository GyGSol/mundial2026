import { describe, it, expect } from 'vitest';
import {
  knockoutTieBlocksMatchFinish,
  matchIndicatesExtraTimePlay,
} from '../src/services/knockoutExtraTimeRules.js';
import { shouldFinalizeStaleLiveMatch, fifaEntryIndicatesFinished } from '../src/services/matchStatusRules.js';

describe('knockoutExtraTimeRules', () => {
  const kickoff = new Date('2026-06-29T20:30:00.000Z');

  const knockoutTie = {
    externalId: '80',
    type: 'r32',
    homeScore: 1,
    awayScore: 1,
    kickoffAt: kickoff,
    raw: {
      finished: 'TRUE',
      time_elapsed: 'finished',
      home_scorers: [{ name: 'Havertz', minute: 54 }],
      away_scorers: [{ name: 'Ansisv', minute: 42 }],
    },
  };

  it('bloquea cierre en eliminatoria 1-1 al pitido de los 90', () => {
    expect(knockoutTieBlocksMatchFinish(knockoutTie)).toBe(true);
    expect(shouldFinalizeStaleLiveMatch({ ...knockoutTie, status: 'live' })).toBe(false);
  });

  it('no bloquea eliminatoria con ganador', () => {
    expect(
      knockoutTieBlocksMatchFinish({
        ...knockoutTie,
        homeScore: 2,
        awayScore: 1,
      })
    ).toBe(false);
  });

  it('no bloquea fase de grupos empatada', () => {
    expect(
      knockoutTieBlocksMatchFinish({
        externalId: '25',
        type: 'group',
        homeScore: 1,
        awayScore: 1,
        raw: { finished: 'TRUE', time_elapsed: 'finished' },
      })
    ).toBe(false);
  });

  it('detecta alargue por minuto > 90', () => {
    const match = {
      externalId: '80',
      type: 'r32',
      homeScore: 1,
      awayScore: 1,
      raw: {
        finished: 'FALSE',
        time_elapsed: '95',
        fifaEvents: {
          timeline: [{ type: 'goal', minute: 95, side: 'home', sortKey: 95 }],
        },
      },
    };
    expect(matchIndicatesExtraTimePlay(match)).toBe(true);
    expect(knockoutTieBlocksMatchFinish(match)).toBe(true);
  });

  it('fifaEntry FullTime no finaliza eliminatoria empatada', () => {
    const fifaEntry = { Period: 'FullTime' };
    expect(fifaEntryIndicatesFinished(fifaEntry, knockoutTie)).toBe(false);
    expect(fifaEntryIndicatesFinished(fifaEntry)).toBe(true);
  });

  it('permite finalizar tras penales', () => {
    const match = {
      externalId: '80',
      type: 'r32',
      homeScore: 1,
      awayScore: 1,
      raw: {
        finished: 'TRUE',
        time_elapsed: 'finished',
        fifaMeta: { homePenaltyScore: 4, awayPenaltyScore: 3 },
      },
    };
    expect(knockoutTieBlocksMatchFinish(match)).toBe(false);
  });
});
