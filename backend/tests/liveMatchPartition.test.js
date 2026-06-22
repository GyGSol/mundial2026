import { describe, it, expect } from 'vitest';
import {
  isMatchActivelyLive,
  shouldFinalizeStaleLiveMatch,
} from '../src/services/matchStatusRules.js';
import {
  partitionLiveMatchesByActivity,
  buildFeaturedRecentFinishedRaw,
  sortLiveMatchesForFeaturedBar,
  liveMatchFeaturedSortTier,
} from '../src/services/liveMatchPartitionService.js';
import { buildLiveScheduleContext } from '../src/services/liveScheduleOverlapService.js';

const kickoff = new Date('2026-06-17T20:00:00.000Z');

describe('isMatchActivelyLive', () => {
  it('devuelve true para live en juego', () => {
    const match = {
      status: 'live',
      kickoffAt: kickoff,
      raw: { time_elapsed: '31', finished: 'FALSE' },
    };
    expect(isMatchActivelyLive(match, kickoff.getTime() + 35 * 60 * 1000)).toBe(true);
  });

  it('devuelve false para live-zombie con match_end', () => {
    const match = {
      status: 'live',
      kickoffAt: kickoff,
      raw: {
        finished: 'FALSE',
        time_elapsed: 'final',
        fifaEvents: { timeline: [{ type: 'match_end', minute: 99, sortKey: 99 }] },
      },
    };
    const now = kickoff.getTime() + 110 * 60 * 1000;
    expect(shouldFinalizeStaleLiveMatch(match, now)).toBe(true);
    expect(isMatchActivelyLive(match, now)).toBe(false);
  });
});

describe('liveMatchPartitionService', () => {
  it('separa activos de zombies', () => {
    const active = {
      _id: 'a',
      status: 'live',
      kickoffAt: kickoff,
      raw: { time_elapsed: '31', finished: 'FALSE' },
    };
    const zombie = {
      _id: 'z',
      status: 'live',
      kickoffAt: kickoff,
      raw: {
        time_elapsed: 'final',
        finished: 'FALSE',
        fifaEvents: { timeline: [{ type: 'match_end', minute: 99, sortKey: 99 }] },
      },
    };
    const now = kickoff.getTime() + 110 * 60 * 1000;
    const { activeLiveRaw, staleLiveRaw } = partitionLiveMatchesByActivity([active, zombie], now);
    expect(activeLiveRaw).toHaveLength(1);
    expect(staleLiveRaw).toHaveLength(1);
    expect(buildFeaturedRecentFinishedRaw([], staleLiveRaw, now)).toHaveLength(1);
  });

  it('ordena activos arriba y suspendidos abajo en partidos en curso', () => {
    const active = {
      id: 'nor-sen',
      status: 'live',
      kickoffAt: new Date('2026-06-21T00:00:00.000Z'),
      weatherOps: { phase: 'normal' },
      raw: { time_elapsed: "12'", finished: 'FALSE' },
    };
    const suspended = {
      id: 'fra-irq',
      status: 'live',
      kickoffAt: new Date('2026-06-20T21:00:00.000Z'),
      weatherOps: { phase: 'suspended' },
      raw: { time_elapsed: "45+4'", finished: 'FALSE' },
    };

    expect(liveMatchFeaturedSortTier(active)).toBe(0);
    expect(liveMatchFeaturedSortTier(suspended)).toBe(1);

    const sorted = sortLiveMatchesForFeaturedBar([suspended, active]);
    expect(sorted.map((m) => m.id)).toEqual(['nor-sen', 'fra-irq']);
  });
});

describe('buildLiveScheduleContext concurrent count', () => {
  it('cuenta solo live activos cuando hay zombie', () => {
    const kickoffSlot = new Date('2026-06-20T22:00:00.000Z');
    const now = kickoff.getTime() + 110 * 60 * 1000;
    const active = {
      _id: 'm1',
      group: 'H',
      matchday: '3',
      kickoffAt: kickoffSlot,
      status: 'live',
      raw: { time_elapsed: '31', finished: 'FALSE' },
    };
    const zombie = {
      _id: 'm2',
      group: 'H',
      matchday: '3',
      kickoffAt: kickoffSlot,
      status: 'live',
      raw: {
        time_elapsed: 'final',
        fifaEvents: { timeline: [{ type: 'match_end', minute: 99, sortKey: 99 }] },
      },
    };
    const ctx = buildLiveScheduleContext(active, [active, zombie], now);
    expect(ctx.concurrentLiveCount).toBe(1);
    expect(ctx.staleLiveCount).toBe(1);
  });

  it('cuenta 3 live activos', () => {
    const all = ['m1', 'm2', 'm3'].map((id) => ({
      _id: id,
      id,
      status: 'live',
      kickoffAt: kickoff,
      raw: { time_elapsed: '20', finished: 'FALSE' },
    }));
    const ctx = buildLiveScheduleContext(all[0], all, kickoff.getTime() + 25 * 60 * 1000);
    expect(ctx.concurrentLiveCount).toBe(3);
  });
});
