import { describe, expect, it } from 'vitest';
import { getEffectiveMatchPlayState, resolvePausedDisplayClock } from './matchPlayState.js';

describe('matchPlayState', () => {
  it('frozenClock en suspensión climática usa max(timeElapsed, cronología)', () => {
    const match = {
      status: 'live',
      timeElapsed: "15'",
      weatherOps: { phase: 'suspended', source: 'nws' },
      matchTimeline: [
        { type: 'foul', minute: 12, sortKey: 12 },
        { type: 'foul', minute: 14, sortKey: 14 },
        { type: 'yellow_card', minute: 19, sortKey: 19 },
      ],
    };

    const state = getEffectiveMatchPlayState(match);
    expect(state.phase).toBe('suspended');
    expect(state.frozenClock).toBe("19'");
    expect(resolvePausedDisplayClock(state)).toBe("19'");
  });

  it('complementa frozenClock del servidor con cronología más avanzada', () => {
    const match = {
      status: 'live',
      timeElapsed: "32'",
      matchPlayState: {
        phase: 'suspended',
        reason: 'weather',
        label: 'Suspendido por clima',
        frozenClock: "15'",
        source: 'weather_ops',
      },
      matchTimeline: [{ type: 'foul', minute: 32, sortKey: 32 }],
    };

    const state = getEffectiveMatchPlayState(match);
    expect(state.frozenClock).toBe("32'");
  });
});
