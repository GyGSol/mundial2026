import { describe, it, expect } from 'vitest';
import {
  isMatchKickoffStale,
  matchEvidentlyStarted,
  shouldFinalizeStaleLiveMatch,
  fifaEntryIndicatesFinished,
  matchFifaTimelineIndicatesFinished,
  MATCH_STALE_AFTER_KICKOFF_MS,
} from '../src/services/matchStatusRules.js';

describe('matchStatusRules', () => {
  const kickoff = new Date('2026-06-17T20:00:00.000Z');

  it('detecta kickoff vencido tras ventana de cierre', () => {
    const now = kickoff.getTime() + MATCH_STALE_AFTER_KICKOFF_MS + 1;
    expect(isMatchKickoffStale(kickoff, now)).toBe(true);
  });

  it('no cierra live reciente', () => {
    const now = kickoff.getTime() + 30 * 60 * 1000;
    const match = {
      status: 'live',
      kickoffAt: kickoff,
      raw: { time_elapsed: '45', finished: 'FALSE' },
    };
    expect(shouldFinalizeStaleLiveMatch(match, now)).toBe(false);
  });

  it('cierra live estancado con time_elapsed=live', () => {
    const now = kickoff.getTime() + MATCH_STALE_AFTER_KICKOFF_MS + 1;
    const match = {
      status: 'live',
      kickoffAt: kickoff,
      homeScore: 0,
      awayScore: 0,
      raw: { time_elapsed: 'live', finished: 'FALSE' },
    };
    expect(matchEvidentlyStarted(match)).toBe(true);
    expect(shouldFinalizeStaleLiveMatch(match, now)).toBe(true);
  });

  it('cierra live cuando raw indica finished=TRUE', () => {
    const match = {
      status: 'live',
      kickoffAt: kickoff,
      raw: { finished: 'TRUE', time_elapsed: 'live' },
    };
    expect(shouldFinalizeStaleLiveMatch(match, kickoff.getTime() + 60_000)).toBe(true);
  });

  it('detecta partido finalizado en calendario FIFA', () => {
    expect(fifaEntryIndicatesFinished({ Period: 'FullTime' })).toBe(true);
    expect(fifaEntryIndicatesFinished({ MatchStatus: 'ended' })).toBe(true);
    expect(fifaEntryIndicatesFinished({ Period: 'FirstHalf' })).toBe(false);
  });

  it('cierra live cuando la timeline FIFA tiene match_end', () => {
    const match = {
      status: 'live',
      kickoffAt: kickoff,
      raw: {
        finished: 'FALSE',
        time_elapsed: 'live',
        fifaEvents: { timeline: [{ type: 'match_end', minute: 95 }] },
      },
    };
    expect(matchFifaTimelineIndicatesFinished(match)).toBe(true);
    expect(shouldFinalizeStaleLiveMatch(match, kickoff.getTime() + 60_000)).toBe(true);
  });
});
