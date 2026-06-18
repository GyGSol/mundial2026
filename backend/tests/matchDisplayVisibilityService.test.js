import { describe, it, expect } from 'vitest';
import {
  RECENTLY_FINISHED_GRACE_MS,
  applyStatusTransitionFields,
  findRecentlyFinishedMatchesQuery,
  findRecentlyFinishedMatchesQueryWithGroup,
  findLiveMatchesQueryWithGroup,
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
  });

  it('findRecentlyFinishedMatchesQueryWithGroup filtra por grupo', () => {
    expect(findRecentlyFinishedMatchesQueryWithGroup('C', now.getTime()).group).toBe('C');
    expect(findRecentlyFinishedMatchesQueryWithGroup('', now.getTime()).group).toBeUndefined();
  });

  it('findLiveMatchesQueryWithGroup filtra live por grupo', () => {
    expect(findLiveMatchesQueryWithGroup('A')).toEqual({ status: 'live', group: 'A' });
    expect(findLiveMatchesQueryWithGroup()).toEqual({ status: 'live' });
  });
});
