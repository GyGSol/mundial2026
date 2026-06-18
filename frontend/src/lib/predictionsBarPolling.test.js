import { describe, expect, it } from 'vitest';
import {
  matchBarFeaturedIds,
  predictionsListExcludeIds,
  predictionsPollIntervalMs,
  shouldPollPredictionsBar,
} from './predictionsBarPolling.js';
import {
  LEADERBOARD_ACTIVE_POLL_MS,
  LEADERBOARD_LIVE_POLL_MS,
} from './leaderboardPolling.js';

describe('predictionsBarPolling', () => {
  const live = [{ id: 'live-1' }];
  const recent = [{ id: 'fin-1', status: 'finished', finishedAt: new Date().toISOString() }];
  const allMatches = [
    ...live.map((m) => ({ ...m, status: 'live' })),
    ...recent,
    { id: 'old-fin', status: 'finished', finishedAt: '2020-01-01T00:00:00.000Z' },
  ];

  it('barra con live no incluye recién finalizados', () => {
    const ids = matchBarFeaturedIds({ liveMatches: live, recentFinishedMatches: recent });
    expect([...ids]).toEqual(['live-1']);
  });

  it('con live oculta en vivo y recién finalizados del listado', () => {
    const ids = predictionsListExcludeIds({
      liveMatches: live,
      recentFinishedMatches: recent,
      allMatches,
    });
    expect(ids.has('live-1')).toBe(true);
    expect(ids.has('fin-1')).toBe(true);
    expect(ids.has('old-fin')).toBe(false);
  });

  it('sin live oculta en vivo y recién finalizados de la barra', () => {
    const ids = predictionsListExcludeIds({
      liveMatches: [],
      recentFinishedMatches: recent,
      allMatches,
    });
    expect(ids.has('fin-1')).toBe(true);
    expect(ids.has('live-1')).toBe(false);
  });

  it('con live usa recentFinishedMatches del API aunque venga vacío en barra', () => {
    const ids = predictionsListExcludeIds({
      liveMatches: live,
      recentFinishedMatches: recent,
      allMatches: live.map((m) => ({ ...m, status: 'live' })),
    });
    expect(ids.has('live-1')).toBe(true);
    expect(ids.has('fin-1')).toBe(true);
  });

  it('poll activo con live o recién finalizados', () => {
    expect(shouldPollPredictionsBar({ liveMatches: live })).toBe(true);
    expect(shouldPollPredictionsBar({ liveMatches: [], recentFinishedMatches: recent })).toBe(
      true
    );
  });

  it('poll 5s con live, 10s con recién finalizados', () => {
    expect(predictionsPollIntervalMs({ liveMatches: live })).toBe(LEADERBOARD_LIVE_POLL_MS);
    expect(
      predictionsPollIntervalMs({ liveMatches: [], recentFinishedMatches: recent })
    ).toBe(LEADERBOARD_ACTIVE_POLL_MS);
  });
});
