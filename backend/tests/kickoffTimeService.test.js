import { describe, it, expect } from 'vitest';
import {
  resolveDisplayKickoffAt,
  resolveOfficialKickoffAt,
  resolveScheduleKickoffAt,
} from '../src/services/kickoffTimeService.js';

describe('kickoff resolution', () => {
  it('resolveScheduleKickoffAt prefers official fixture over stale DB kickoffAt', () => {
    const official = resolveOfficialKickoffAt('1');
    const scheduled = resolveScheduleKickoffAt({
      externalId: '1',
      kickoffAt: new Date('2026-06-11T00:00:00.000Z'),
    });

    expect(scheduled?.getTime()).toBe(official?.getTime());
  });

  it('resolveDisplayKickoffAt uses stored kickoff when weather delayed', () => {
    const delayed = new Date('2026-06-12T20:00:00.000Z');
    const displayed = resolveDisplayKickoffAt({
      externalId: '1',
      kickoffAt: delayed,
      weatherOps: { phase: 'pre_kickoff_delay' },
    });

    expect(displayed?.getTime()).toBe(delayed.getTime());
  });

  it('resolveScheduleKickoffAt falls back to stored kickoff for simulation matches', () => {
    const stored = new Date('2026-07-01T12:00:00.000Z');
    const scheduled = resolveScheduleKickoffAt({
      externalId: 'sim-run-1',
      kickoffAt: stored,
    });

    expect(scheduled?.getTime()).toBe(stored.getTime());
  });
});
