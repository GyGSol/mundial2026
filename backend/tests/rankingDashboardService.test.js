import { describe, it, expect } from 'vitest';
import { partitionRankingDashboardMatches } from '../src/services/rankingDashboardService.js';

describe('rankingDashboardService', () => {
  describe('partitionRankingDashboardMatches', () => {
    it('mantiene live con timeElapsed Final en liveMatches, no en recentFinished', () => {
      const live = [
        {
          id: 'live-1',
          status: 'live',
          timeElapsed: 'Final',
          kickoffAt: '2026-06-17T20:00:00.000Z',
        },
      ];
      const finished = [
        {
          id: 'fin-1',
          status: 'finished',
          timeElapsed: 'Final',
          kickoffAt: '2026-06-17T17:00:00.000Z',
        },
      ];

      const { liveMatches, recentFinishedMatches } = partitionRankingDashboardMatches(live, finished);

      expect(liveMatches).toHaveLength(1);
      expect(liveMatches[0].id).toBe('live-1');
      expect(recentFinishedMatches).toHaveLength(1);
      expect(recentFinishedMatches[0].id).toBe('fin-1');
      expect(recentFinishedMatches.some((m) => m.id === 'live-1')).toBe(false);
    });

    it('reclasifica finished prematuro con timeline temprana a liveMatches', () => {
      const kickoffRecent = new Date(Date.now() - 20 * 60 * 1000).toISOString();
      const finishedRaw = [
        {
          _id: 'uzb-col',
          status: 'finished',
          kickoffAt: kickoffRecent,
          raw: {
            finished: 'FALSE',
            time_elapsed: 'live',
            fifaEvents: {
              timeline: [{ type: 'foul', minute: 14, sortKey: 14 }],
            },
          },
        },
      ];
      const finished = [
        {
          id: 'uzb-col',
          status: 'finished',
          timeElapsed: 'Final',
          kickoffAt: kickoffRecent,
          matchTimeline: [{ type: 'foul', minute: 14, sortKey: 14 }],
        },
      ];

      const { liveMatches, recentFinishedMatches } = partitionRankingDashboardMatches(
        [],
        finished,
        finishedRaw
      );

      expect(liveMatches).toHaveLength(1);
      expect(liveMatches[0].status).toBe('live');
      expect(liveMatches[0].timeElapsed).toBe("14'");
      expect(recentFinishedMatches).toHaveLength(0);
    });
  });
});
