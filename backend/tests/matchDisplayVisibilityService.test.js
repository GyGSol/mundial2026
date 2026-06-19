import { describe, it, expect } from 'vitest';
import {
  RECENTLY_FINISHED_GRACE_MS,
  MAX_MATCH_DURATION_MS,
  applyStatusTransitionFields,
  findRecentlyFinishedMatchesQuery,
  findRecentlyFinishedMatchesQueryWithGroup,
  findLiveMatchesQueryWithGroup,
  isEligibleRecentFinishedMatch,
  pickFeaturedRecentFinishedMatches,
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

  it('no sobrescribe finishedAt si ya estaba finished', () => {
    const prior = new Date('2026-06-15T19:00:00.000Z');
    const update = { status: 'finished', finishedAt: prior };
    applyStatusTransitionFields(update, {
      previousStatus: 'finished',
      nextStatus: 'finished',
      now,
    });
    expect(update.finishedAt).toEqual(prior);
  });

  it('conserva finishedAt al reabrir de finished a live', () => {
    const prior = new Date('2026-06-15T19:00:00.000Z');
    const update = { status: 'live', finishedAt: prior };
    applyStatusTransitionFields(update, {
      previousStatus: 'finished',
      nextStatus: 'live',
      now,
    });
    expect(update.finishedAt).toEqual(prior);
  });

  it('re-finalize conserva finishedAt previo', () => {
    const prior = new Date('2026-06-18T21:55:00.000Z');
    const update = { status: 'finished' };
    applyStatusTransitionFields(update, {
      previousStatus: 'live',
      nextStatus: 'finished',
      now,
      existingFinishedAt: prior,
    });
    expect(update.finishedAt).toEqual(prior);
  });

  it('findRecentlyFinishedMatchesQuery acota por kickoff reciente', () => {
    const query = findRecentlyFinishedMatchesQuery(now.getTime());
    expect(query.status).toBe('finished');
    expect(query.kickoffAt.$gte).toEqual(
      new Date(now.getTime() - RECENTLY_FINISHED_GRACE_MS - MAX_MATCH_DURATION_MS)
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

  it('isEligibleRecentFinishedMatch usa fin efectivo por timeline, no finishedAt refrescado', () => {
    const now = new Date('2026-06-19T00:20:00.000Z').getTime();
    expect(
      isEligibleRecentFinishedMatch(
        {
          status: 'finished',
          finishedAt: new Date('2026-06-19T00:10:46.000Z'),
          kickoffAt: new Date('2026-06-18T16:00:00.000Z'),
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
          finishedAt: new Date('2026-06-19T00:00:45.000Z'),
          kickoffAt: new Date('2026-06-18T22:00:00.000Z'),
          raw: {
            fifaEvents: {
              timeline: [{ type: 'match_end', minute: 90, sortKey: 90 }],
            },
          },
        },
        now
      )
    ).toBe(true);
  });

  it('isEligibleRecentFinishedMatch exige reloj de pared creíble', () => {
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
  });

  it('pickFeaturedRecentFinishedMatches devuelve solo el más reciente por kickoff', () => {
    const now = new Date('2026-06-19T00:20:00.000Z').getTime();
    const picked = pickFeaturedRecentFinishedMatches(
      [
        {
          id: '25',
          status: 'finished',
          kickoffAt: new Date('2026-06-18T16:00:00.000Z'),
          finishedAt: new Date('2026-06-19T00:10:46.605Z'),
          raw: { fifaEvents: { timeline: [{ type: 'match_end', minute: 98, sortKey: 98 }] } },
        },
        {
          id: '27',
          status: 'finished',
          kickoffAt: new Date('2026-06-18T22:00:00.000Z'),
          finishedAt: new Date('2026-06-19T00:00:45.500Z'),
          raw: { fifaEvents: { timeline: [{ type: 'match_end', minute: 90, sortKey: 90 }] } },
        },
      ],
      now
    );
    expect(picked).toHaveLength(1);
    expect(picked[0].id).toBe('27');
  });

  it('pickFeaturedRecentFinishedMatches desempata por fin efectivo con mismo kickoff', () => {
    const now = new Date('2026-06-18T21:10:00.000Z').getTime();
    const kickoff = new Date('2026-06-18T19:15:00.000Z');
    const base = {
      status: 'finished',
      kickoffAt: kickoff,
      raw: { fifaEvents: { timeline: [{ type: 'match_end', minute: 90, sortKey: 90 }] } },
    };
    const picked = pickFeaturedRecentFinishedMatches(
      [
        { ...base, id: '25', finishedAt: new Date('2026-06-18T20:58:00.000Z') },
        { ...base, id: '26', finishedAt: new Date('2026-06-18T21:01:00.000Z') },
      ],
      now
    );
    expect(picked).toHaveLength(1);
    expect(picked[0].id).toBe('26');
  });
});
