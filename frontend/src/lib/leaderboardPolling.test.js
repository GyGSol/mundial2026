import { describe, it, expect } from 'vitest';
import { shouldPollLeaderboardLive } from '../src/lib/leaderboardPolling.js';

describe('shouldPollLeaderboardLive', () => {
  it('poll con partidos en vivo', () => {
    expect(shouldPollLeaderboardLive({ liveMatches: [{ id: '1' }] })).toBe(true);
  });

  it('poll con partidos recién finalizados', () => {
    expect(
      shouldPollLeaderboardLive({
        liveMatches: [],
        recentFinishedMatches: [{ id: '1' }],
      })
    ).toBe(true);
  });

  it('poll con próximos partidos', () => {
    expect(
      shouldPollLeaderboardLive({
        liveMatches: [],
        nextUpcomingMatches: [{ id: '1' }],
      })
    ).toBe(true);
  });

  it('no poll sin actividad', () => {
    expect(shouldPollLeaderboardLive({})).toBe(false);
  });
});
