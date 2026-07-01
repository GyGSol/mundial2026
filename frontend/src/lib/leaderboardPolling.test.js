import { describe, it, expect } from 'vitest';
import {
  leaderboardPollIntervalMs,
  LEADERBOARD_ACTIVE_POLL_MS,
  LEADERBOARD_IDLE_POLL_MS,
  LEADERBOARD_LIVE_POLL_MS,
  LEADERBOARD_SINGLE_LIVE_POLL_MS,
  shouldPollLeaderboardLive,
} from './leaderboardPolling.js';

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

describe('leaderboardPollIntervalMs', () => {
  it('10s con un solo partido en vivo', () => {
    expect(leaderboardPollIntervalMs({ liveMatches: [{ id: '1' }] })).toBe(
      LEADERBOARD_SINGLE_LIVE_POLL_MS
    );
  });

  it('15s con dos o más partidos en vivo', () => {
    expect(
      leaderboardPollIntervalMs({ liveMatches: [{ id: '1' }, { id: '2' }] })
    ).toBe(LEADERBOARD_LIVE_POLL_MS);
  });

  it('10s con recién finalizados sin live', () => {
    expect(
      leaderboardPollIntervalMs({ liveMatches: [], recentFinishedMatches: [{ id: '1' }] })
    ).toBe(LEADERBOARD_ACTIVE_POLL_MS);
  });

  it('15s en reposo', () => {
    expect(leaderboardPollIntervalMs({})).toBe(LEADERBOARD_IDLE_POLL_MS);
  });
});
