import { describe, expect, it } from 'vitest';
import {
  estimateLiveClockFromKickoff,
  kickoffClockShouldOverride,
} from '../liveMatchKickoffClock.js';

describe('liveMatchKickoffClock', () => {
  const kickoffAt = '2026-07-02T00:00:00.000Z';

  it('estima minuto desde kickoff', () => {
    expect(estimateLiveClockFromKickoff(kickoffAt, Date.parse('2026-07-02T00:20:00.000Z'))).toBe(
      "20'"
    );
    expect(estimateLiveClockFromKickoff(kickoffAt, Date.parse('2026-07-02T00:00:30.000Z'))).toBe(
      "1'"
    );
  });

  it('descuenta entretiempo aproximado tras 45 min de pared', () => {
    expect(estimateLiveClockFromKickoff(kickoffAt, Date.parse('2026-07-02T00:52:00.000Z'))).toBe(
      "45'"
    );
  });

  it('override cuando FIFA queda en 0', () => {
    expect(kickoffClockShouldOverride("0'", "20'")).toBe(true);
    expect(kickoffClockShouldOverride(null, "20'")).toBe(true);
    expect(kickoffClockShouldOverride("58'", "20'")).toBe(false);
    expect(kickoffClockShouldOverride("48'", "50'")).toBe(false);
  });
});
