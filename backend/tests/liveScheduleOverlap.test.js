import { describe, it, expect } from 'vitest';
import {
  buildLiveScheduleContext,
  buildSimultaneousGroupPairs,
} from '../src/services/liveScheduleOverlapService.js';

function match(id, overrides = {}) {
  return {
    _id: id,
    id,
    homeTeamId: 'A',
    awayTeamId: 'B',
    group: 'H',
    matchday: '3',
    kickoffAt: new Date('2026-06-20T22:00:00.000Z'),
    status: 'live',
    weatherOps: { phase: 'normal' },
    ...overrides,
  };
}

describe('liveScheduleOverlapService', () => {
  it('detecta parejas de grupo con mismo kickoff', () => {
    const kickoff = new Date('2026-06-20T22:00:00.000Z');
    const m1 = match('m1', { kickoffAt: kickoff });
    const m2 = match('m2', { homeTeamId: 'C', awayTeamId: 'D', kickoffAt: kickoff });
    const pairs = buildSimultaneousGroupPairs([m1, m2]);
    expect(pairs.get('m1')?.simultaneousGroupPair).toBe(true);
    expect(pairs.get('m1')?.partnerMatchIds).toContain('m2');
  });

  it('emite integrityWarning si un partido del par está demorado y el otro sigue', () => {
    const kickoff = new Date('2026-06-20T22:00:00.000Z');
    const delayed = match('m1', {
      kickoffAt: kickoff,
      weatherOps: { phase: 'suspended' },
    });
    const playing = match('m2', {
      homeTeamId: 'C',
      awayTeamId: 'D',
      kickoffAt: kickoff,
      status: 'live',
      weatherOps: { phase: 'normal' },
    });
    const ctx = buildLiveScheduleContext(delayed, [delayed, playing]);
    expect(ctx.integrityWarning).toMatch(/otro partido del mismo grupo/i);
    expect(ctx.simultaneousGroupPair?.partnerMatchIds).toContain('m2');
  });

  it('cuenta partidos live concurrentes', () => {
    const all = [match('m1'), match('m2', { status: 'upcoming' })];
    const ctx = buildLiveScheduleContext(all[0], all);
    expect(ctx.concurrentLiveCount).toBe(1);
  });
});
