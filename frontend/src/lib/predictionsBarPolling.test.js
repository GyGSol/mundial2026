import { describe, expect, it } from 'vitest';
import {
  matchBarFeaturedIds,
  predictionsListExcludeIds,
} from './predictionsBarPolling.js';

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

  it('sin live oculta solo lo de la barra recién finalizada', () => {
    const ids = predictionsListExcludeIds({
      liveMatches: [],
      recentFinishedMatches: recent,
      allMatches,
    });
    expect(ids.has('fin-1')).toBe(true);
    expect(ids.has('live-1')).toBe(false);
  });
});
