import { describe, expect, it } from 'vitest';
import {
  latestClockFromTimeline,
  latestMinuteFromScorerLists,
  pickAdvancedRawElapsed,
  pickLiveDisplayClock,
  resolveLiveMatchDisplayClock,
  resolveLiveTimeElapsed,
} from './liveMatchClock.js';

describe('liveMatchClock', () => {
  it('elige el reloj más avanzado entre 45+5 y 59', () => {
    expect(pickAdvancedRawElapsed('45+5', '59')).toBe('59');
    expect(pickAdvancedRawElapsed('59', '45+5')).toBe('59');
  });

  it('supera entretiempo si la cronología ya pasó al 2.º tiempo', () => {
    expect(
      resolveLiveTimeElapsed({ time_elapsed: 'ht' }, [{ minute: 59, sortKey: 59 }])
    ).toBe("59'");
  });

  it('toma el último minuto de la cronología unida', () => {
    expect(
      latestClockFromTimeline([
        { minute: 45, extraMinute: 5, sortKey: 45.05 },
        { minute: 59, sortKey: 59 },
      ])
    ).toBe("59'");
  });

  it('supera el minuto del último gol si el servidor marca 78', () => {
    expect(
      pickLiveDisplayClock("59'", "78'", resolveLiveTimeElapsed({ time_elapsed: '59' }, [
        { minute: 59, sortKey: 59 },
      ]))
    ).toBe("78'");
  });

  it('usa el último minuto de goleadores cuando la cronología FIFA va atrasada', () => {
    const match = {
      status: 'live',
      homeScore: 4,
      awayScore: 1,
      homeScorers: [
        { name: 'Kvdi Khakpv', minute: 47 },
        { name: 'Kvdi Khakpv', minute: 54 },
      ],
      awayScorers: [{ name: 'Anthony Elanga', minute: 59 }],
      matchTimeline: [{ type: 'goal', side: 'home', minute: 17, sortKey: 17 }],
      timeElapsed: "45+5'",
      raw: { time_elapsed: 'live' },
    };

    expect(latestMinuteFromScorerLists(match.homeScorers, match.awayScorers)).toBe("59'");
    expect(resolveLiveMatchDisplayClock(match)).toBe("59'");
  });
});
