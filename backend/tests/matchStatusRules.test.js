import { describe, it, expect } from 'vitest';
import {
  isMatchKickoffStale,
  matchEvidentlyStarted,
  matchEvidenceShowsInProgress,
  shouldFinalizeStaleLiveMatch,
  fifaEntryIndicatesFinished,
  matchFifaTimelineIndicatesFinished,
  elapsedTokenIndicatesFinished,
  wallClockAllowsMatchFinished,
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

  it('no cierra live con finished=TRUE si timeline muestra minuto temprano', () => {
    const match = {
      status: 'live',
      kickoffAt: kickoff,
      raw: {
        finished: 'TRUE',
        time_elapsed: 'final',
        fifaEvents: {
          timeline: [
            { type: 'kickoff', minute: 0, sortKey: 0 },
            { type: 'goal', minute: 4, side: 'home', sortKey: 4 },
          ],
        },
      },
    };
    expect(shouldFinalizeStaleLiveMatch(match, kickoff.getTime() + 10 * 60 * 1000)).toBe(false);
  });

  it('no cierra live con time_elapsed=final si timeline muestra minuto temprano', () => {
    const match = {
      status: 'live',
      kickoffAt: kickoff,
      raw: {
        finished: 'FALSE',
        time_elapsed: 'final',
        fifaEvents: {
          timeline: [
            { type: 'kickoff', minute: 0, sortKey: 0 },
            { type: 'substitution', minute: 4, sortKey: 4 },
          ],
        },
      },
    };
    expect(shouldFinalizeStaleLiveMatch(match, kickoff.getTime() + 10 * 60 * 1000)).toBe(false);
  });

  it('cierra live cuando time_elapsed es ft o fulltime', () => {
    for (const token of ['ft', 'FT', 'fulltime', 'final']) {
      const match = {
        status: 'live',
        kickoffAt: kickoff,
        raw: { finished: 'FALSE', time_elapsed: token },
      };
      expect(shouldFinalizeStaleLiveMatch(match, kickoff.getTime() + 30 * 60 * 1000)).toBe(true);
    }
  });

  it('elapsedTokenIndicatesFinished reconoce tokens de pitido final', () => {
    expect(elapsedTokenIndicatesFinished('finished')).toBe(true);
    expect(elapsedTokenIndicatesFinished('FT')).toBe(true);
    expect(elapsedTokenIndicatesFinished('fulltime')).toBe(true);
    expect(elapsedTokenIndicatesFinished('45')).toBe(false);
  });

  it('detecta partido finalizado en calendario FIFA', () => {
    expect(fifaEntryIndicatesFinished({ Period: 'FullTime' })).toBe(true);
    expect(fifaEntryIndicatesFinished({ MatchStatus: 'ended' })).toBe(true);
    expect(fifaEntryIndicatesFinished({ Period: 'FirstHalf' })).toBe(false);
  });

  it('cierra live cuando la timeline FIFA tiene match_end y el reloj de pared alcanza', () => {
    const match = {
      status: 'live',
      kickoffAt: kickoff,
      raw: {
        finished: 'FALSE',
        time_elapsed: 'live',
        fifaEvents: { timeline: [{ type: 'match_end', minute: 95, sortKey: 95 }] },
      },
    };
    expect(matchFifaTimelineIndicatesFinished(match)).toBe(true);
    const now = kickoff.getTime() + 110 * 60 * 1000;
    expect(shouldFinalizeStaleLiveMatch(match, now)).toBe(true);
  });

  it('no cierra live con match_end si el reloj de pared es demasiado corto', () => {
    const match = {
      status: 'live',
      kickoffAt: kickoff,
      raw: {
        finished: 'FALSE',
        time_elapsed: 'live',
        fifaEvents: { timeline: [{ type: 'match_end', minute: 98, sortKey: 98 }] },
      },
    };
    const now = kickoff.getTime() + 58 * 60 * 1000;
    expect(shouldFinalizeStaleLiveMatch(match, now)).toBe(false);
    expect(wallClockAllowsMatchFinished({ ...match, status: 'finished' }, now)).toBe(false);
  });

  it('cierra live en 90+ con reloj de pared creíble aunque falte match_end', () => {
    const match = {
      status: 'live',
      kickoffAt: kickoff,
      raw: {
        finished: 'FALSE',
        time_elapsed: '90+9',
        fifaEvents: {
          timeline: [
            { type: 'hydration_break', minute: 90, extraMinute: 9, sortKey: 90.09 },
            { type: 'shot_attempt', minute: 90, extraMinute: 9, sortKey: 90.09 },
          ],
        },
      },
    };
    const now = kickoff.getTime() + 105 * 60 * 1000;
    expect(shouldFinalizeStaleLiveMatch(match, now)).toBe(true);
  });

  it('prioriza liveStartedPushSentAt sobre kickoff programado temprano', () => {
    const officialKickoff = new Date('2026-06-18T16:00:00.000Z');
    const liveStarted = new Date('2026-06-18T19:00:00.000Z');
    const match = {
      status: 'finished',
      externalId: '25',
      kickoffAt: officialKickoff,
      liveStartedPushSentAt: liveStarted,
      raw: {
        fifaEvents: { timeline: [{ type: 'match_end', minute: 98, sortKey: 98 }] },
      },
    };
    const now = liveStarted.getTime() + 75 * 60 * 1000;
    expect(wallClockAllowsMatchFinished(match, now)).toBe(false);
  });

  it('sin ancla de kickoff no permite finalizar', () => {
    expect(
      wallClockAllowsMatchFinished({
        status: 'finished',
        raw: { fifaEvents: { timeline: [{ type: 'match_end', minute: 90, sortKey: 90 }] } },
      })
    ).toBe(false);
  });

  it('no bloquea cierre cuando timeline quedó en HT pero goleadores avanzaron (NED–SWE)', () => {
    const now = kickoff.getTime() + MATCH_STALE_AFTER_KICKOFF_MS + 5 * 60 * 1000;
    const match = {
      status: 'live',
      kickoffAt: kickoff,
      homeScore: 5,
      awayScore: 1,
      raw: {
        finished: 'FALSE',
        time_elapsed: '45+5',
        home_scorers: [
          { name: 'Brobbey', minute: 5 },
          { name: 'Brobbey', minute: 17 },
          { name: 'Khakpo', minute: 47 },
          { name: 'Khakpo', minute: 54 },
          { name: 'Summerville', minute: 89 },
        ],
        away_scorers: [{ name: 'Elanga', minute: 59 }],
        fifaEvents: {
          timeline: [
            { type: 'kickoff', minute: 0, sortKey: 0 },
            { type: 'goal', minute: 5, side: 'home', sortKey: 5 },
            { type: 'halftime', minute: 45, sortKey: 45 },
          ],
        },
      },
    };

    expect(matchEvidenceShowsInProgress(match)).toBe(false);
    expect(shouldFinalizeStaleLiveMatch(match, now)).toBe(true);
  });

  it('sigue bloqueando cierre prematuro si solo timeline temprana y sin goleadores tardíos', () => {
    const match = {
      status: 'live',
      kickoffAt: kickoff,
      raw: {
        finished: 'TRUE',
        time_elapsed: 'final',
        home_scorers: [{ name: 'Early', minute: 4 }],
        fifaEvents: {
          timeline: [
            { type: 'kickoff', minute: 0, sortKey: 0 },
            { type: 'goal', minute: 4, side: 'home', sortKey: 4 },
          ],
        },
      },
    };
    expect(shouldFinalizeStaleLiveMatch(match, kickoff.getTime() + 10 * 60 * 1000)).toBe(false);
  });
});
