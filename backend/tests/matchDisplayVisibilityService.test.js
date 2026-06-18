import { describe, it, expect } from 'vitest';
import {
  RECENTLY_FINISHED_GRACE_MS,
  applyStatusTransitionFields,
  findRecentlyFinishedMatchesQuery,
  findRecentlyFinishedMatchesQueryWithGroup,
  findLiveMatchesQueryWithGroup,
  isEligibleRecentFinishedMatch,
} from '../src/services/matchDisplayVisibilityService.js';

describe('matchDisplayVisibilityService', () => {
  const now = new Date('2026-06-15T20:00:00.000Z');

  it('setea finishedAt al pasar a finished', () => {
    const update = { status: 'finished' };
    applyStatusTransitionFields(update, {
      previousStatus: 'live',
      nextStatus: 'finished',
      now,
    });
    expect(update.finishedAt).toEqual(now);
  });

  it('no sobrescribe si ya estaba finished', () => {
    const update = { status: 'finished', finishedAt: new Date('2026-06-15T19:00:00.000Z') };
    applyStatusTransitionFields(update, {
      previousStatus: 'finished',
      nextStatus: 'finished',
      now,
    });
    expect(update.finishedAt).toEqual(new Date('2026-06-15T19:00:00.000Z'));
  });

  it('limpia finishedAt al reabrir de finished a live', () => {
    const update = { status: 'live' };
    applyStatusTransitionFields(update, {
      previousStatus: 'finished',
      nextStatus: 'live',
      now,
    });
    expect(update.finishedAt).toBeNull();
  });

  it('findRecentlyFinishedMatchesQuery usa ventana de 30 min', () => {
    const query = findRecentlyFinishedMatchesQuery(now.getTime());
    expect(query.status).toBe('finished');
    expect(query.finishedAt.$gte).toEqual(
      new Date(now.getTime() - RECENTLY_FINISHED_GRACE_MS)
    );
    expect(query.kickoffAt.$lte).toEqual(new Date(now.getTime()));
  });

  it('findRecentlyFinishedMatchesQueryWithGroup filtra por grupo', () => {
    expect(findRecentlyFinishedMatchesQueryWithGroup('C', now.getTime()).group).toBe('C');
    expect(findRecentlyFinishedMatchesQueryWithGroup('', now.getTime()).group).toBeUndefined();
  });

  it('findLiveMatchesQueryWithGroup filtra live por grupo', () => {
    expect(findLiveMatchesQueryWithGroup('A')).toEqual({ status: 'live', group: 'A' });
    expect(findLiveMatchesQueryWithGroup()).toEqual({ status: 'live' });
  });

  it('isEligibleRecentFinishedMatch exige finishedAt y reloj de pared creíble', () => {
    const now = new Date('2026-06-18T18:58:00.000Z').getTime();
    const kickoff = new Date('2026-06-18T18:00:00.000Z');
    expect(
      isEligibleRecentFinishedMatch(
        {
          status: 'finished',
          finishedAt: new Date(now - 5 * 60 * 1000).toISOString(),
          kickoffAt: kickoff,
          raw: {
            fifaEvents: {
              timeline: [{ type: 'match_end', minute: 98, sortKey: 98 }],
            },
          },
        },
        now
      )
    ).toBe(false);

    expect(
      isEligibleRecentFinishedMatch(
        {
          status: 'finished',
          finishedAt: new Date(now - 5 * 60 * 1000).toISOString(),
          kickoffAt: new Date('2026-06-18T15:00:00.000Z'),
          raw: {
            fifaEvents: {
              timeline: [{ type: 'match_end', minute: 98, sortKey: 98 }],
            },
          },
        },
        now
      )
    ).toBe(true);
  });
});
