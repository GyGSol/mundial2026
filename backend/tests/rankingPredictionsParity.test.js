import { describe, it, expect } from 'vitest';
import { enrichMatchLiveFields } from '../src/services/matchLiveData.js';
import { pickFeaturedRecentFinishedMatches } from '../src/services/matchDisplayVisibilityService.js';

describe('rankingPredictionsParity', () => {
  it('pickFeatured elige el mismo destacado que ranking y predicciones comparten', () => {
    const now = new Date('2026-06-19T00:20:00.000Z').getTime();
    const matches = [
      {
        externalId: '25',
        status: 'finished',
        finishedAt: new Date('2026-06-19T00:10:46.000Z'),
        kickoffAt: new Date('2026-06-18T16:00:00.000Z'),
        raw: {
          fifaEvents: {
            timeline: [{ minute: 90, extraMinute: 8, type: 'match_end', sortKey: 90.08 }],
          },
        },
      },
      {
        externalId: '27',
        status: 'finished',
        finishedAt: new Date('2026-06-19T00:00:45.000Z'),
        kickoffAt: new Date('2026-06-18T22:00:00.000Z'),
        raw: {
          fifaEvents: {
            timeline: [{ minute: 90, type: 'match_end', sortKey: 90 }],
          },
        },
      },
    ];

    expect(pickFeaturedRecentFinishedMatches(matches, now).map((m) => m.externalId)).toEqual([
      '27',
    ]);
  });

  it('enrichMatchLiveFields expone el marcador efectivo usado por ranking y predicciones', () => {
    const match = {
      status: 'finished',
      homeScore: 4,
      awayScore: 1,
      raw: {
        fifaMeta: {
          homeScore: 4,
          awayScore: 1,
          syncedAt: '2026-06-18T21:30:00.000Z',
        },
        fifaEvents: {
          timeline: [
            { type: 'goal', side: 'home', minute: 74, sortKey: 74 },
            { type: 'goal', side: 'home', minute: 84, sortKey: 84 },
            { type: 'goal', side: 'home', minute: 90, sortKey: 90 },
            { type: 'goal', side: 'home', minute: 92, extraMinute: 1, sortKey: 92.01 },
            { type: 'goal', side: 'away', minute: 55, sortKey: 55 },
          ],
        },
      },
    };

    const enriched = enrichMatchLiveFields(match);
    expect(enriched.homeScore).toBe(4);
    expect(enriched.awayScore).toBe(1);
  });
});
